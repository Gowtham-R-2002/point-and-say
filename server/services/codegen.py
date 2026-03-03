"""
Code Generation Service — Nova Premier

Given a component's source code and a user's intent,
generates modified code using Nova Premier.
"""
import json
import os
import re
import boto3
from botocore.config import Config


def get_bedrock_client():
    """Create a Bedrock Runtime client."""
    region = os.getenv("AWS_BEDROCK_REGION", "us-east-1")
    config = Config(
        region_name=region,
        retries={"max_attempts": 3, "mode": "adaptive"},
    )
    return boto3.client("bedrock-runtime", config=config)


def parse_nova_json(raw_text: str) -> dict:
    """
    Parse JSON from Nova's response, handling common issues:
    - Markdown code blocks wrapping
    - Invalid escape sequences (\\` and \\$) in template literals
    - Literal newlines inside JSON strings
    """
    clean = raw_text.strip()

    # Strip markdown code blocks
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[1]
        clean = clean.rsplit("```", 1)[0]
        clean = clean.strip()

    print(f"   Nova raw response length: {len(clean)}")
    print(f"   Nova raw response preview: {clean[:200]}")

    # Attempt 1: direct parse with strict=False
    try:
        return json.loads(clean, strict=False)
    except json.JSONDecodeError as e1:
        print(f"   JSON parse attempt 1 failed: {e1}")

    # Attempt 2: fix invalid escapes (\\` → `, \\$ → $)
    # These are NOT valid JSON escapes but Nova produces them for template literals
    fixed = clean.replace('\\`', '`').replace('\\$', '$')
    try:
        result = json.loads(fixed, strict=False)
        print(f"   JSON parse attempt 2 succeeded (fixed invalid escapes)")
        return result
    except json.JSONDecodeError as e2:
        print(f"   JSON parse attempt 2 failed: {e2}")

    # Attempt 3: index-based extraction
    print(f"   Attempting index-based extraction...")
    code_key = '"modifiedCode"'
    expl_key = '"explanation"'
    code_idx = fixed.find(code_key)
    expl_idx = fixed.find(expl_key)

    if code_idx >= 0 and expl_idx > code_idx:
        # Find the opening " of the value after "modifiedCode":
        colon_idx = fixed.index(':', code_idx + len(code_key))
        val_start = fixed.index('"', colon_idx + 1) + 1
        # Find the closing " before "explanation"
        val_end = fixed.rindex('"', val_start, expl_idx)
        raw_code = fixed[val_start:val_end]

        # Unescape standard JSON string escapes
        raw_code = (raw_code
                    .replace('\\n', '\n')
                    .replace('\\t', '\t')
                    .replace('\\"', '"')
                    .replace('\\/', '/')
                    .replace('\\\\', '\\'))

        # Extract explanation
        expl_match = re.search(r'"explanation"\s*:\s*"([^"]*)"', fixed[expl_idx:])
        explanation = expl_match.group(1) if expl_match else "Code modified"

        print(f"   Index extraction succeeded, code length: {len(raw_code)}")
        return {"modifiedCode": raw_code, "explanation": explanation}

    raise ValueError(f"Could not parse Nova response after all attempts")


def _detect_styling_approach(source_code: str) -> str:
    """Detect the styling approach used in the source code."""
    if 'className="' in source_code and ('flex ' in source_code or 'grid ' in source_code or 'rounded-' in source_code or 'text-' in source_code):
        return "tailwind"
    if 'styled(' in source_code or '@emotion' in source_code:
        return "css-in-js"
    if 'sx={{' in source_code or 'sx={' in source_code:
        return "mui"
    if 'var(--' in source_code:
        return "css-vars"
    return "generic"


def _build_design_context(source_code: str, styling: str) -> str:
    """Build design system context based on the detected styling approach."""
    if styling == "tailwind":
        return """DESIGN SYSTEM (Tailwind CSS + CSS Variables):
This project uses Tailwind CSS for styling. The codebase uses CSS custom properties
defined in index.css via @theme directive. Common variables:
Surfaces: --color-surface-0 through --color-surface-4 (dark theme)
Borders: --color-border-subtle, --color-border-default, --color-border-strong
Text: --color-text-primary, --color-text-secondary, --color-text-muted
Accents: --color-accent-teal, --color-accent-violet, --color-accent-amber, --color-accent-rose, --color-accent-blue, --color-accent-emerald
Each accent has a -soft variant (e.g. --color-accent-teal-soft)
Status: --color-success, --color-warning, --color-error
Fonts: --font-display, --font-body, --font-mono
Use Tailwind utilities (flex, grid, rounded-2xl, p-6, etc.) for layout.
Use style={{ }} with CSS vars for colors: style={{ color: 'var(--color-accent-teal)' }}"""

    if styling == "mui":
        return """DESIGN SYSTEM (MUI + CSS Custom Properties):
Backgrounds: --bg-base (#0c0c14), --bg-elevated (#13131f), --bg-surface, --bg-glass
Borders: --border-glass, --border-glass-hover, --border-accent
Text: --text-primary (#f4f4f8), --text-secondary (#8b8b9e), --text-muted, --text-accent
Accents: --accent-primary (#fb8c66), --accent-secondary (#a78bfa), --accent-purple, --accent-emerald, --accent-blue, --accent-rose, --accent-amber
Use MUI's sx prop for styling. Cards use .glass-card class."""

    # Default: CSS custom properties / vanilla
    return """DESIGN SYSTEM (CSS Custom Properties):
Backgrounds: --bg-base (#0c0c14), --bg-elevated (#13131f), --bg-surface, --bg-glass, --bg-glass-strong
Borders: --border-glass, --border-glass-hover, --border-accent
Text: --text-primary (#f4f4f8), --text-secondary (#8b8b9e), --text-muted (#5c5c72), --text-accent (#fb8c66)
Accents: --accent-primary (#fb8c66), --accent-secondary (#a78bfa), --accent-purple (#a855f7), --accent-emerald (#34d399), --accent-blue (#60a5fa), --accent-rose (#fb7185), --accent-amber (#fbbf24)
Each accent has a -soft variant for backgrounds (e.g. --accent-primary-soft)
Spacing: --space-xs (0.25rem) through --space-3xl (3.5rem)
Radius: --radius-sm (8px), --radius-md (12px), --radius-lg (16px), --radius-full (50px)
Fonts: --font-sans (Plus Jakarta Sans), --font-mono (JetBrains Mono)
Theme: Dark glassmorphism with warm orange accent. Cards use .glass-card class."""


def _build_styling_rules(styling: str) -> str:
    """Build styling-specific rules based on the detected approach."""
    if styling == "tailwind":
        return """4. Use Tailwind CSS utilities for layout and spacing (flex, grid, p-4, rounded-xl, etc.)
5. Use style={{ }} attribute with CSS custom properties for dynamic colors
6. Preserve all existing Tailwind class names — only add/modify relevant ones
7. Use framer-motion props (initial, animate, transition, whileHover, whileTap) for animations if framer-motion is already imported
8. For new colors, prefer CSS variables: style={{ color: 'var(--color-accent-teal)' }}"""

    if styling == "mui":
        return """4. Use CSS custom properties (var(--accent-blue), etc.) for colors when possible
5. For inline styles, use the sx prop (MUI) or style attribute
6. Maintain the glassmorphism aesthetic (dark backgrounds, subtle borders, soft glows)"""

    return """4. Use CSS custom properties (var(--accent-blue), etc.) for colors when possible
5. For inline styles, use the style attribute
6. Maintain the dark theme aesthetic"""


def generate_code_change(
    component_name: str,
    file_path: str,
    source_code: str,
    intent: str,
) -> dict:
    """
    Use Nova to generate a code modification.
    Auto-detects the styling approach (Tailwind, MUI, CSS vars)
    and adjusts the prompt accordingly.

    Returns:
        dict with modifiedCode, explanation
    """
    client = get_bedrock_client()

    # Auto-detect the styling approach
    styling = _detect_styling_approach(source_code)
    design_system = _build_design_context(source_code, styling)
    styling_rules = _build_styling_rules(styling)

    # Detect if framer-motion is used
    uses_framer = 'framer-motion' in source_code or 'motion.' in source_code
    framer_note = "\n- Animation: Use framer-motion props (whileHover, animate, transition) if already imported" if uses_framer else "\n- Animation: Use CSS keyframes or transition properties"

    # Detect if lucide-react is used
    uses_lucide = 'lucide-react' in source_code
    icon_note = "\n- Icons: Use lucide-react icons if already imported, do NOT add new icon libraries" if uses_lucide else ""

    prompt = f"""You are a precise React/TypeScript code editor.

{design_system}

COMPONENT: {component_name}
FILE: {file_path}
USER REQUEST: "{intent}"

CURRENT SOURCE CODE:
```tsx
{source_code}
```

RULES — You MUST follow these exactly:
1. Return the COMPLETE modified file — every single line, not just the changed parts
2. Only change what the user asked for — preserve all other code exactly
3. Keep ALL imports, exports, types, and function signatures unchanged
{styling_rules}
9. Do NOT add new npm dependencies or imports that don't already exist in the file
10. Do NOT escape backticks or dollar signs — template literals must stay as-is
11. Ensure valid TypeScript JSX — no syntax errors
12. Keep data-component attributes unchanged
13. NEVER import external libraries like d3, chart.js, recharts, etc. — use pure SVG/CSS only
14. For charts or visualizations, use inline SVG with math calculations — no charting libraries
15. The code must work STANDALONE without adding any new npm packages

COMMON PATTERNS:
- Color changes: Use CSS custom properties or hex values in style attribute
- Text changes: Modify JSX string content directly
- Layout: Adjust flexbox/grid properties{framer_note}{icon_note}
- Visibility: Toggle display or conditional rendering

Return ONLY raw JSON (no markdown wrapping):
{{
  "modifiedCode": "...complete file content...",
  "explanation": "Short description of changes made"
}}"""

    body = json.dumps({
        "messages": [
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        "inferenceConfig": {
            "maxTokens": 8192,
            "temperature": 0.05,
        },
    })

    # Nova Premier for code generation — flagship model with superior reasoning
    model_id = os.getenv("NOVA_CODEGEN_MODEL_ID", "amazon.nova-premier-v1:0")

    response = client.invoke_model(
        modelId=model_id,
        body=body,
        contentType="application/json",
        accept="application/json",
    )

    result = json.loads(response["body"].read())
    output_text = result["output"]["message"]["content"][0]["text"]

    return parse_nova_json(output_text)


def generate_code_change_mock(
    component_name: str,
    file_path: str,
    source_code: str,
    intent: str,
) -> dict:
    """
    Mock code generation — performs simple text/style substitutions
    for development without AWS credentials.
    """
    modified = source_code
    explanation = ""
    intent_lower = intent.lower()

    # Color changes
    color_map = {
        "blue": "#3b82f6",
        "red": "#ef4444",
        "green": "#22c55e",
        "purple": "#a855f7",
        "orange": "#f97316",
        "pink": "#ec4899",
        "yellow": "#eab308",
        "white": "#ffffff",
        "black": "#000000",
    }

    for color_name, hex_val in color_map.items():
        if color_name in intent_lower and ("color" in intent_lower or "background" in intent_lower or "make" in intent_lower):
            if "background" in intent_lower or "bg" in intent_lower:
                modified = modified.replace("var(--accent-primary)", hex_val)
                modified = modified.replace("#fb8c66", hex_val)
                explanation = f"Changed background color to {color_name} ({hex_val})"
            else:
                explanation = f"Changed color to {color_name} ({hex_val})"
            break

    # Text changes
    if "change text" in intent_lower or "rename" in intent_lower or "say" in intent_lower:
        quotes = re.findall(r'"([^"]+)"', intent)
        if len(quotes) >= 1:
            new_text = quotes[-1]
            explanation = f"Changed text to '{new_text}'"

    # Font size changes
    if "bigger" in intent_lower or "larger" in intent_lower:
        modified = modified.replace("fontSize: '", "fontSize: '2")
        explanation = "Increased font size"
    elif "smaller" in intent_lower:
        modified = modified.replace("fontSize: '2", "fontSize: '1")
        explanation = "Decreased font size"

    # Rounded corners
    if "rounded" in intent_lower or "round" in intent_lower:
        modified = modified.replace("borderRadius: '", "borderRadius: '50")
        explanation = "Added more rounded corners"

    if not explanation:
        explanation = f"Mock: Would apply '{intent}' to {component_name}"

    return {
        "modifiedCode": modified,
        "explanation": explanation,
        "mock": True,
    }
