"""
Test Script — Nova 2 Sonic TTS / STT feasibility check

Nova Sonic is a speech-to-speech model using InvokeModelWithBidirectionalStream.
This requires HTTP/2 bidirectional streaming — NOT available in standard boto3.

This script:
1. Checks if Nova 2 Sonic is accessible in your account
2. Tests if your boto3 supports bidirectional streaming
3. Tests Polly (our current TTS) for comparison
4. Provides recommendations

Usage:
    cd server
    ./venv/bin/python tests/test_sonic_tts.py
"""
import os
import sys
import base64
from datetime import datetime

# Add server directory to path
SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SERVER_DIR)
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(SERVER_DIR), ".env")
load_dotenv(_env_path)

REGION = os.getenv("AWS_REGION", "us-east-1")
SONIC_MODEL_ID = "amazon.nova-2-sonic-v1:0"


def log(emoji: str, msg: str):
    ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"{emoji} [{ts}] {msg}")


def check_sonic_model_access():
    """Step 1: Check if Nova 2 Sonic is available."""
    import boto3

    log("🔍", "Checking Nova 2 Sonic model access...")

    client = boto3.client(
        "bedrock",
        region_name=REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )

    try:
        response = client.list_foundation_models(byProvider="amazon")
        sonic_models = [
            m for m in response.get("modelSummaries", [])
            if "sonic" in m.get("modelId", "").lower()
        ]

        if sonic_models:
            log("✅", f"Found {len(sonic_models)} Sonic model(s):")
            for m in sonic_models:
                mid = m["modelId"]
                name = m.get("modelName", "N/A")
                streaming = m.get("responseStreamingSupported", False)
                log("  ", f"  {mid} — {name} (streaming: {streaming})")
            return True
        else:
            log("⚠️", "No Sonic models found. Enable model access in Bedrock console.")
            return False

    except Exception as e:
        log("❌", f"Error: {type(e).__name__}: {e}")
        return False


def check_bidirectional_streaming():
    """Step 2: Check if boto3 supports bidirectional streaming."""
    import boto3

    log("🔍", f"Checking boto3 bidirectional streaming support (v{boto3.__version__})...")

    client = boto3.client(
        "bedrock-runtime",
        region_name=REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )

    # Check for the bidirectional streaming method
    has_bidi = hasattr(client, "invoke_model_with_bidirectional_stream")
    invoke_methods = [m for m in dir(client) if "invoke" in m.lower() or "stream" in m.lower()]

    log("📋", f"Available invoke/stream methods: {invoke_methods}")

    if has_bidi:
        log("✅", "invoke_model_with_bidirectional_stream is AVAILABLE!")
        return True
    else:
        log("⚠️", "invoke_model_with_bidirectional_stream NOT available")
        log("💡", "Nova Sonic bidirectional streaming requires AWS SDK with HTTP/2 support")
        log("💡", "Standard boto3 does not include this API yet")
        log("💡", "Options:")
        log("  ", "  1. Use the aws-sdk-python-signers approach from AWS samples")
        log("  ", "  2. Use WebSocket proxy approach (ws → backend → bedrock)")
        log("  ", "  3. Use converse_stream for text-only interactions")
        return False


def test_converse_stream():
    """Step 3: Test if we can at least use converse_stream (text mode)."""
    import boto3

    log("🔍", "Testing converse_stream with Nova Sonic (text mode)...")

    client = boto3.client(
        "bedrock-runtime",
        region_name=REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )

    try:
        response = client.converse_stream(
            modelId=SONIC_MODEL_ID,
            messages=[{
                "role": "user",
                "content": [{"text": "Say hello in one sentence."}]
            }],
            inferenceConfig={
                "maxTokens": 100,
                "temperature": 0.7,
            },
        )

        # Collect streamed text
        full_text = ""
        for event in response.get("stream", []):
            if "contentBlockDelta" in event:
                delta = event["contentBlockDelta"].get("delta", {})
                if "text" in delta:
                    full_text += delta["text"]

        if full_text:
            log("✅", f"converse_stream works! Response: \"{full_text.strip()}\"")
            return True
        else:
            log("⚠️", "converse_stream returned empty response")
            return False

    except Exception as e:
        log("❌", f"converse_stream failed: {type(e).__name__}: {e}")
        return False


def test_polly():
    """Step 4: Test Polly (our current working TTS)."""
    import boto3

    log("🔊", "Testing Amazon Polly (current TTS)...")

    client = boto3.client(
        "polly",
        region_name=REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )

    text = "Done! I've changed the button color to blue."

    # Test generative engine
    for engine, voice in [("generative", "Ruth"), ("neural", "Ruth"), ("standard", "Joanna")]:
        try:
            response = client.synthesize_speech(
                Text=text,
                OutputFormat="mp3",
                VoiceId=voice,
                Engine=engine,
            )
            audio = response["AudioStream"].read()
            log("✅", f"Polly {engine}/{voice}: {len(audio)} bytes")

            # Save the first successful one
            output_path = os.path.join(SERVER_DIR, "tests", "polly_test_output.mp3")
            with open(output_path, "wb") as f:
                f.write(audio)
            log("💾", f"Saved to: {output_path}")
            return True
        except Exception as e:
            log("⚠️", f"Polly {engine}/{voice}: {type(e).__name__}: {e}")

    return False


if __name__ == "__main__":
    print("=" * 60)
    print("  Nova Sonic & Polly TTS/STT Test")
    print("=" * 60)
    print()

    # 1. Check model access
    sonic_available = check_sonic_model_access()
    print()

    # 2. Check bidirectional streaming
    bidi_available = check_bidirectional_streaming()
    print()

    # 3. Test converse_stream (text-only fallback)
    converse_works = test_converse_stream()
    print()

    # 4. Test Polly
    polly_works = test_polly()
    print()

    # Summary
    print("=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    print(f"  Nova Sonic model accessible:     {'✅ Yes' if sonic_available else '❌ No'}")
    print(f"  Bidirectional stream support:     {'✅ Yes' if bidi_available else '❌ No (needs SDK upgrade)'}")
    print(f"  converse_stream (text mode):      {'✅ Yes' if converse_works else '❌ No'}")
    print(f"  Amazon Polly TTS:                 {'✅ Yes' if polly_works else '❌ No'}")
    print()

    if sonic_available and not bidi_available:
        print("  ┌─────────────────────────────────────────────────────┐")
        print("  │ RECOMMENDATION:                                    │")
        print("  │                                                    │")
        print("  │ Nova 2 Sonic IS in your account but the Python SDK │")
        print("  │ doesn't support bidirectional streaming yet.       │")
        print("  │                                                    │")
        print("  │ For the hackathon, the best approach is:           │")
        print("  │  • Keep Polly for TTS (it works great)             │")
        print("  │  • Keep Web Speech API for STT                     │")
        print("  │  • You're ALREADY using 4 Nova services:           │")
        print("  │    Nova 2 Lite + Nova Premier + Nova Act + Polly   │")
        print("  │                                                    │")
        print("  │ Adding Sonic would require setting up a WebSocket  │")
        print("  │ proxy — high risk for marginal hackathon benefit.  │")
        print("  └─────────────────────────────────────────────────────┘")
    print()
