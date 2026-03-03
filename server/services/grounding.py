"""
Visual Grounding Service — Nova 2 Lite Vision API

Takes a screenshot with pointer overlay and identifies
which UI component the user is pointing at.
"""
import json
import base64
import os
import boto3
from botocore.config import Config


# Component registry matching the frontend
COMPONENT_REGISTRY = {
    "hero-section": {
        "name": "HeroSection",
        "filePath": "src/app/components/HeroSection.tsx",
        "description": "Hero banner with gradient title and CTA button",
    },
    "stats-card-1": {
        "name": "StatsCards",
        "filePath": "src/app/components/StatsCards.tsx",
        "description": "Total Revenue stat card",
    },
    "stats-card-2": {
        "name": "StatsCards",
        "filePath": "src/app/components/StatsCards.tsx",
        "description": "Active Users stat card",
    },
    "stats-card-3": {
        "name": "StatsCards",
        "filePath": "src/app/components/StatsCards.tsx",
        "description": "Completion Rate stat card",
    },
    "stats-card-4": {
        "name": "StatsCards",
        "filePath": "src/app/components/StatsCards.tsx",
        "description": "Tasks Done stat card",
    },
    "action-button": {
        "name": "ActionButton",
        "filePath": "src/app/components/ActionButton.tsx",
        "description": "Primary CTA button with gradient",
    },
    "profile-card": {
        "name": "ProfileCard",
        "filePath": "src/app/components/ProfileCard.tsx",
        "description": "User profile card with avatar and stats",
    },
    "data-table": {
        "name": "DataTable",
        "filePath": "src/app/components/DataTable.tsx",
        "description": "Recent activity data table",
    },
    "analytics-chart": {
        "name": "AnalyticsChart",
        "filePath": "src/app/components/AnalyticsChart.tsx",
        "description": "Revenue growth area chart",
    },
    "sidebar": {
        "name": "Sidebar",
        "filePath": "src/app/components/Sidebar.tsx",
        "description": "Icon-only navigation sidebar",
    },
}


def get_bedrock_client():
    """Create a Bedrock Runtime client."""
    region = os.getenv("AWS_BEDROCK_REGION", "us-east-1")
    config = Config(
        region_name=region,
        retries={"max_attempts": 3, "mode": "adaptive"},
    )
    return boto3.client("bedrock-runtime", config=config)


def ground_component(image_base64: str, pointer_x: float, pointer_y: float) -> dict:
    """
    Send annotated screenshot to Nova Lite and identify the component
    at the pointer position.

    Returns:
        dict with componentName, elementType, currentProperties, confidence, filePath
    """
    client = get_bedrock_client()

    # Build the component list for context - be very explicit
    component_list = "\n".join(
        f"  • data-component=\"{key}\" → componentName: \"{info['name']}\" — {info['description']}"
        for key, info in COMPONENT_REGISTRY.items()
    )

    prompt = f"""Look at this screenshot of a dashboard UI. There is a RED DOT marking where the user clicked (approximately at pixel position x={pointer_x:.0f}, y={pointer_y:.0f}).

Your task: identify which UI component the RED DOT is pointing at or closest to.

The dashboard contains these components (listed top-to-bottom as they appear):

{component_list}

IMPORTANT RULES:
1. Focus on WHERE the red dot is located in the image
2. The componentName MUST be one of these exact values: HeroSection, StatsCards, ActionButton, ProfileCard, DataTable, AnalyticsChart, Sidebar
3. If the red dot is on or near a stat card (showing numbers like revenue, users, rate, tasks), return componentName "StatsCards"
4. Use the correct data-component attribute that matches the specific card/section
5. Do NOT guess ActionButton unless the red dot is clearly on the floating action button (bottom-right corner)

Return ONLY valid JSON (no markdown, no extra text):
{{
  "componentName": "exact name from list above",
  "dataAttribute": "the data-component value",
  "elementType": "button|card|text|table|section|chart|sidebar",
  "currentProperties": {{"key": "value"}},
  "confidence": 0.95
}}"""

    # Construct the Nova Lite request
    body = json.dumps({
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "image": {
                            "format": "png",
                            "source": {"bytes": image_base64},
                        }
                    },
                    {"text": prompt},
                ],
            }
        ],
        "inferenceConfig": {
            "maxTokens": 512,
            "temperature": 0.1,
        },
    })

    model_id = os.getenv("NOVA_LITE_MODEL_ID", "amazon.nova-lite-v2:0")

    response = client.invoke_model(
        modelId=model_id,
        body=body,
        contentType="application/json",
        accept="application/json",
    )

    result = json.loads(response["body"].read())
    output_text = result["output"]["message"]["content"][0]["text"]

    # Log raw response
    print(f"   Nova grounding raw response: {output_text[:500]}")

    # Parse the JSON from Nova's response
    clean_text = output_text.strip()
    if clean_text.startswith("```"):
        clean_text = clean_text.split("\n", 1)[1]
        clean_text = clean_text.rsplit("```", 1)[0]

    grounding = json.loads(clean_text, strict=False)

    # Validate componentName is in our registry
    valid_names = {info["name"] for info in COMPONENT_REGISTRY.values()}
    if grounding.get("componentName") not in valid_names:
        print(f"   ⚠️ Nova returned invalid componentName: {grounding.get('componentName')}")
        # Try to fix by matching dataAttribute
        data_attr = grounding.get("dataAttribute", "")
        if data_attr in COMPONENT_REGISTRY:
            grounding["componentName"] = COMPONENT_REGISTRY[data_attr]["name"]
            print(f"   Fixed to: {grounding['componentName']} via dataAttribute")

    # Enrich with file path from registry
    data_attr = grounding.get("dataAttribute", "")
    if data_attr in COMPONENT_REGISTRY:
        grounding["filePath"] = COMPONENT_REGISTRY[data_attr]["filePath"]
    else:
        # Fallback: try to match by componentName
        for key, info in COMPONENT_REGISTRY.items():
            if info["name"] == grounding.get("componentName"):
                grounding["filePath"] = info["filePath"]
                grounding["dataAttribute"] = key
                break

    return grounding



def ground_component_mock(pointer_x: float, pointer_y: float, image_width: float, image_height: float) -> dict:
    """
    Mock grounding that uses pointer position heuristics.
    Used when AWS credentials aren't configured yet.
    """
    # Normalize coordinates to 0-1 range
    nx = pointer_x / image_width if image_width > 0 else 0.5
    ny = pointer_y / image_height if image_height > 0 else 0.5

    # Position-based heuristics (approximate dashboard layout)
    if nx < 0.06:
        component = "sidebar"
    elif ny < 0.12:
        component = "hero-section"  # header area
    elif ny < 0.35:
        component = "hero-section"
    elif ny < 0.5:
        # Stats strip — determine which card by x position
        if nx < 0.3:
            component = "stats-card-1"
        elif nx < 0.5:
            component = "stats-card-2"
        elif nx < 0.7:
            component = "stats-card-3"
        else:
            component = "stats-card-4"
    elif ny < 0.75:
        if nx < 0.55:
            component = "analytics-chart"
        else:
            component = "profile-card"
    else:
        component = "data-table"

    info = COMPONENT_REGISTRY.get(component, COMPONENT_REGISTRY["hero-section"])

    return {
        "componentName": info["name"],
        "dataAttribute": component,
        "elementType": "section",
        "currentProperties": {},
        "confidence": 0.85,
        "filePath": info["filePath"],
        "mock": True,
    }
