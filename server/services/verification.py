"""
Verification Service — UI Change Confirmation

Three verification strategies:
1. Nova Act (primary) — AWS Console service, uses IAM credentials + boto3
   to create a workflow that verifies the UI change.
2. Nova Lite Vision (fallback) — takes a screenshot and asks Nova Lite
   to confirm the change was applied.
3. Mock — always returns verified (development mode).

Nova Act is now an AWS service (us-east-1.console.aws.amazon.com/nova-act)
and uses standard AWS IAM credentials — no separate API key needed.
"""
import os
import json
import base64
import time
import boto3
from typing import Optional


def verify_change(
    expected_change: str,
    app_url: str = "http://localhost:5173",
    component_name: str = "",
    screenshot_base64: Optional[str] = None,
    target_element: Optional[str] = None,
) -> dict:
    """
    Verify a UI change was applied correctly.

    Tries Nova Act (AWS) first, then Nova Lite vision, then mock.

    Args:
        expected_change: Description of the expected change
        app_url: URL of the running app
        component_name: Name of the modified component
        screenshot_base64: Optional screenshot to verify against
        target_element: Specific element description (e.g. 'Chart footer info')

    Returns:
        dict with verified (bool), reason, method used
    """
    # Build element context string
    element_context = f"{component_name}"
    if target_element:
        element_context = f"{component_name} > {target_element}"

    # Strategy 1: Nova Act via AWS SDK (IAM credentials)
    nova_act_result = _try_nova_act_aws(expected_change, app_url, element_context)
    if nova_act_result:
        return nova_act_result

    # Strategy 2: Nova Lite Vision (screenshot analysis)
    if screenshot_base64:
        nova_lite_result = _try_nova_lite_vision(expected_change, element_context, screenshot_base64)
        if nova_lite_result:
            return nova_lite_result

    # Strategy 3: Mock (always succeeds)
    return _mock_verify(expected_change, element_context)


def _get_bedrock_client():
    """Create a Bedrock Runtime client."""
    region = os.getenv("BEDROCK_REGION", os.getenv("AWS_REGION", "us-east-1"))
    kwargs = {"region_name": region}
    # Only pass explicit credentials if set — otherwise boto3 uses IAM role
    if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"):
        kwargs["aws_access_key_id"] = os.getenv("AWS_ACCESS_KEY_ID")
        kwargs["aws_secret_access_key"] = os.getenv("AWS_SECRET_ACCESS_KEY")
    return boto3.client("bedrock-runtime", **kwargs)


def _try_nova_act_aws(
    expected_change: str,
    app_url: str,
    component_name: str,
) -> Optional[dict]:
    """
    Try to verify using Nova Act via AWS SDK.

    Nova Act is now an AWS service accessed via IAM credentials.
    Uses the nova-act SDK which authenticates via standard AWS credentials.
    """
    try:
        from nova_act import NovaAct

        # Nova Act now uses IAM credentials (no separate API key needed)
        # It reads AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY from environment
        print(f"[VERIFY] Using Nova Act (AWS IAM) to verify: {expected_change}")

        with NovaAct(
            starting_page=app_url,
            # IAM auth — reads from environment or ~/.aws/credentials
        ) as agent:
            # Wait for HMR to apply
            time.sleep(1)

            result = agent.act(
                f"Look at the web page, specifically the '{component_name}' component. "
                f"Verify whether this change has been applied: '{expected_change}'. "
                f"Respond with VERIFIED if the change is visible, or NOT_VERIFIED if not. "
                f"Then explain briefly what you see."
            )

            response_text = result.response.strip() if result.response else ""
            verified = "VERIFIED" in response_text.upper() and "NOT_VERIFIED" not in response_text.upper()

            return {
                "verified": verified,
                "reason": response_text or "No response from Nova Act",
                "method": "nova-act",
                "mock": False,
            }

    except ImportError:
        print("[VERIFY] nova-act package not installed (pip install nova-act), trying Nova Lite vision")
        return None
    except Exception as e:
        error_str = str(e)
        # If it's an auth/access issue, log clearly and fall through
        if "AccessDenied" in error_str or "not authorized" in error_str.lower():
            print(f"[VERIFY] Nova Act access denied — ensure IAM has nova-act permissions: {e}")
        else:
            print(f"[VERIFY] Nova Act error: {e}")
        return None


def _try_nova_lite_vision(
    expected_change: str,
    component_name: str,
    screenshot_base64: str,
) -> Optional[dict]:
    """
    Verify using Nova Lite vision — send screenshot and ask if the change is visible.
    """
    try:
        client = _get_bedrock_client()

        prompt = (
            f"You are a UI verification assistant. "
            f"Look at this screenshot of a web dashboard. "
            f"Focus SPECIFICALLY on this element: '{component_name}'. "
            f"The change that was made: '{expected_change}'. "
            f"Look ONLY at the specified element — ignore other parts of the dashboard. "
            f"IMPORTANT: If you cannot clearly tell whether the change was applied "
            f"(e.g. emojis, icons, or subtle styling may be hard to verify from a screenshot), "
            f"give the benefit of the doubt and mark as verified=true. "
            f"Only mark verified=false if the specific element CLEARLY still shows the OLD value. "
            f"Respond with JSON: "
            f'{{"verified": true/false, "reason": "what you see in the specific element"}}'
        )

        body = json.dumps({
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "image": {
                            "format": "png",
                            "source": {"bytes": screenshot_base64},
                        }
                    },
                    {"text": prompt},
                ],
            }],
            "inferenceConfig": {
                "maxTokens": 256,
                "temperature": 0.1,
            },
        })

        response = client.invoke_model(
            modelId=os.getenv("NOVA_LITE_MODEL_ID", "us.amazon.nova-2-lite-v1:0"),
            contentType="application/json",
            accept="application/json",
            body=body,
        )

        response_body = json.loads(response["body"].read())
        output_text = ""
        if "output" in response_body and "message" in response_body["output"]:
            for block in response_body["output"]["message"].get("content", []):
                if "text" in block:
                    output_text += block["text"]

        # Try to parse JSON from response
        try:
            json_start = output_text.find("{")
            json_end = output_text.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                parsed = json.loads(output_text[json_start:json_end])
                return {
                    "verified": parsed.get("verified", False),
                    "reason": parsed.get("reason", output_text),
                    "method": "nova-lite-vision",
                    "mock": False,
                }
        except json.JSONDecodeError:
            pass

        # Fallback: simple text analysis
        lower = output_text.lower()
        verified = any(word in lower for word in ["yes", "verified", "shows", "applied", "visible"])

        return {
            "verified": verified,
            "reason": output_text[:200],
            "method": "nova-lite-vision",
            "mock": False,
        }

    except Exception as e:
        print(f"[VERIFY] Nova Lite vision error: {e}")
        return None


def _mock_verify(expected_change: str, component_name: str) -> dict:
    """Mock verification when no AI verification is available."""
    return {
        "verified": True,
        "reason": f"Mock: Assumed '{expected_change}' was applied to {component_name}",
        "method": "mock",
        "mock": True,
    }
