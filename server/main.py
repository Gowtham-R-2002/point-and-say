"""
Point & Say UI — Python Backend
FastAPI server for Nova API orchestration and file operations.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import json
import traceback
import time
from typing import Optional
from datetime import datetime

from services.grounding import ground_component, ground_component_mock, COMPONENT_REGISTRY
from services.codegen import generate_code_change, generate_code_change_mock
from services.verification import verify_change
from services.scanner import scan_project
from services.polly import synthesize_speech as polly_speak

# Load .env from project root (one level up from server/)
_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(_env_path)

app = FastAPI(title="Point & Say UI", version="0.3.0")

# CORS for Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Undo stack (in-memory for hackathon speed)
undo_stack: list[dict] = []
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Project configuration (can be updated via /api/configure)
project_config: dict = {
    "projectPath": PROJECT_ROOT,
    "devServerUrl": "http://localhost:5173",
    "framework": "React (Vite)",
    "configured": True,  # Default: pre-configured for the built-in dashboard
}


def has_aws_credentials() -> bool:
    return bool(os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("AWS_PROFILE"))


def log(emoji: str, title: str, **kwargs):
    """Pretty-print a structured log line."""
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"\n{emoji} [{ts}] {title}")
    for k, v in kwargs.items():
        val = str(v)
        if len(val) > 300:
            val = val[:300] + "..."
        print(f"   {k}: {val}")


# ========== Health ==========

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "0.4.0",
        "aws_region": os.getenv("AWS_REGION", "not set"),
        "aws_configured": has_aws_credentials(),
        "project_configured": project_config["configured"],
    }


# ========== Project Configuration ==========

class ConfigureRequest(BaseModel):
    projectPath: str
    devServerUrl: str = "http://localhost:5173"


BRIDGE_SCRIPT_TAG = '<!-- Point & Say Bridge --><script src="http://localhost:8000/api/bridge.js"></script>'
BRIDGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bridge")


def _inject_bridge(project_path: str) -> bool:
    """Inject the bridge script tag into the target project's index.html."""
    index_path = os.path.join(project_path, "index.html")
    if not os.path.isfile(index_path):
        return False
    with open(index_path, "r") as f:
        content = f.read()
    if "Point & Say Bridge" in content:
        return True
    if "</body>" in content:
        content = content.replace("</body>", f"  {BRIDGE_SCRIPT_TAG}\n</body>")
    elif "</html>" in content:
        content = content.replace("</html>", f"  {BRIDGE_SCRIPT_TAG}\n</html>")
    else:
        content += f"\n{BRIDGE_SCRIPT_TAG}\n"
    with open(index_path, "w") as f:
        f.write(content)
    log("🔗", "BRIDGE INJECTED", file=index_path)
    return True


def _remove_bridge(project_path: str) -> bool:
    """Remove the bridge script tag from a project's index.html."""
    index_path = os.path.join(project_path, "index.html")
    if not os.path.isfile(index_path):
        return False
    with open(index_path, "r") as f:
        content = f.read()
    if "Point & Say Bridge" not in content:
        return True
    lines = content.split("\n")
    lines = [l for l in lines if "Point & Say Bridge" not in l]
    with open(index_path, "w") as f:
        f.write("\n".join(lines))
    log("🧹", "BRIDGE REMOVED", file=index_path)
    return True


@app.get("/api/bridge.js")
async def serve_bridge():
    """Serve the bridge script for injection into target apps."""
    from fastapi.responses import FileResponse
    bridge_path = os.path.join(BRIDGE_DIR, "point-and-say-bridge.js")
    return FileResponse(bridge_path, media_type="application/javascript")


@app.post("/api/configure")
async def configure_project(req: ConfigureRequest):
    """Configure the project to edit. Injects bridge script for iframe communication."""
    global PROJECT_ROOT, project_config

    log("⚙️", "CONFIGURE PROJECT",
        projectPath=req.projectPath,
        devServerUrl=req.devServerUrl)

    if project_config.get("projectPath") and project_config["projectPath"] != req.projectPath:
        _remove_bridge(project_config["projectPath"])

    scan_result = scan_project(req.projectPath)

    if scan_result.get("error"):
        return {"status": "error", "message": scan_result["error"]}

    is_self = os.path.abspath(req.projectPath) == os.path.abspath(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    bridge_injected = False
    if not is_self:
        bridge_injected = _inject_bridge(req.projectPath)

    PROJECT_ROOT = req.projectPath
    project_config = {
        "projectPath": req.projectPath,
        "devServerUrl": req.devServerUrl,
        "framework": scan_result["framework"],
        "configured": True,
        "bridgeInjected": bridge_injected,
        "isExternal": not is_self,
    }

    log("✅", "PROJECT CONFIGURED",
        framework=scan_result["framework"],
        components=scan_result["totalFiles"],
        bridgeInjected=bridge_injected)

    return {
        "status": "ok",
        "config": project_config,
        "scan": scan_result,
    }


@app.get("/api/project-info")
async def project_info():
    """Get current project configuration."""
    scan_result = scan_project(project_config["projectPath"])
    return {
        "status": "ok",
        "config": project_config,
        "scan": scan_result,
    }


@app.post("/api/scan")
async def scan_directory(req: ConfigureRequest):
    """Scan a directory without configuring it."""
    result = scan_project(req.projectPath)
    return {"status": "ok", "scan": result}


# ========== Voice I/O — Amazon Polly TTS ==========

class TranscribeRequest(BaseModel):
    audioBase64: str
    systemPrompt: str = ""


class SpeakRequest(BaseModel):
    text: str


@app.post("/api/sonic/transcribe")
async def sonic_transcribe(req: TranscribeRequest):
    """
    Transcription endpoint.
    STT handled client-side via Web Speech API.
    """
    log("🎤", "TRANSCRIBE", audioLength=len(req.audioBase64))
    return {
        "status": "ok",
        "transcription": "",
        "mock": True,
        "fallback": True,
    }

@app.post("/api/sonic/speak")
async def sonic_speak(req: SpeakRequest):
    """
    Generate speech audio.
    Priority chain: Nova 2 Sonic (JS service) → Amazon Polly → browser TTS fallback.
    """
    log("🔊", "TTS SPEAK", text=req.text[:100])

    # 1. Try Nova 2 Sonic (via JS microservice on port 8001)
    sonic_url = os.getenv("SONIC_SERVICE_URL", "http://localhost:8001")
    try:
        import urllib.request
        sonic_req = urllib.request.Request(
            f"{sonic_url}/tts",
            data=json.dumps({"text": req.text}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(sonic_req, timeout=30) as resp:
            sonic_data = json.loads(resp.read().decode("utf-8"))
            if sonic_data.get("audioBase64") and not sonic_data.get("mock"):
                log("✅", "SONIC TTS",
                    engine=sonic_data.get("engine", "nova-sonic"),
                    chunks=sonic_data.get("chunks", 0),
                    elapsed=f"{sonic_data.get('elapsedMs', 0)}ms")
                return {
                    "status": "ok",
                    "audioBase64": sonic_data["audioBase64"],
                    "format": sonic_data.get("format", "audio/wav"),
                    "engine": "nova-sonic",
                    "mock": False,
                }
    except Exception as e:
        log("⚠️", "SONIC UNAVAILABLE", error=str(e)[:80])

    # 2. Fall back to Amazon Polly
    try:
        polly_audio = polly_speak(req.text)
        if polly_audio:
            log("✅", "POLLY TTS", audioLength=len(polly_audio))
            return {
                "status": "ok",
                "audioBase64": polly_audio,
                "format": "audio/mpeg",
                "engine": "polly",
                "mock": False,
            }
    except Exception as e:
        log("⚠️", "POLLY FAILED", error=str(e))

    # 3. Fall back to browser TTS
    log("⚠️", "TTS FALLBACK", reason="Both Sonic and Polly unavailable, using browser TTS")
    return {"status": "ok", "audioBase64": None, "engine": "browser", "mock": True}


# ========== Components ==========

@app.get("/api/components")
async def list_components():
    return {"status": "ok", "components": COMPONENT_REGISTRY}


# ========== Grounding ==========

class GroundRequest(BaseModel):
    imageBase64: str
    pointerX: float
    pointerY: float
    imageWidth: float
    imageHeight: float


@app.post("/api/ground")
async def ground_element(req: GroundRequest):
    t0 = time.time()
    log("👁️", "GROUNDING REQUEST",
        pointer=f"({req.pointerX:.0f}, {req.pointerY:.0f})",
        image_size=f"{req.imageWidth:.0f}x{req.imageHeight:.0f}",
        using="Nova Vision" if has_aws_credentials() else "Mock (position heuristics)")
    try:
        if has_aws_credentials():
            result = ground_component(
                image_base64=req.imageBase64,
                pointer_x=req.pointerX,
                pointer_y=req.pointerY,
            )
        else:
            result = ground_component_mock(
                pointer_x=req.pointerX,
                pointer_y=req.pointerY,
                image_width=req.imageWidth,
                image_height=req.imageHeight,
            )
        elapsed = time.time() - t0
        log("✅", f"GROUNDING RESULT ({elapsed:.1f}s)",
            component=result.get('componentName'),
            dataAttribute=result.get('dataAttribute'),
            filePath=result.get('filePath'),
            confidence=f"{result.get('confidence', 0):.0%}",
            mock=result.get('mock', False))
        return {"status": "ok", "grounding": result}
    except Exception as e:
        elapsed = time.time() - t0
        log("❌", f"GROUNDING ERROR ({elapsed:.1f}s) — falling back to mock",
            error=f"{type(e).__name__}: {e}")
        traceback.print_exc()
        result = ground_component_mock(
            pointer_x=req.pointerX,
            pointer_y=req.pointerY,
            image_width=req.imageWidth,
            image_height=req.imageHeight,
        )
        result["error"] = str(e)
        result["fallback"] = True
        return {"status": "ok", "grounding": result}


# ========== Code Generation ==========

class GenerateRequest(BaseModel):
    componentName: str
    filePath: str
    intent: str
    targetElement: Optional[str] = None  # e.g. "Call-to-action button — 'Get Started'"


@app.post("/api/generate")
async def generate_code(req: GenerateRequest):
    """Generate modified code for a component based on user intent."""
    t0 = time.time()
    # Build precise intent with target element context
    precise_intent = req.intent
    if req.targetElement:
        precise_intent = f"TARGET ELEMENT: {req.targetElement}. USER REQUEST: {req.intent}"

    log("🧠", "CODEGEN REQUEST",
        component=req.componentName,
        file=req.filePath,
        intent=precise_intent,
        targetElement=req.targetElement or "(whole component)",
        using="Nova Pro" if has_aws_credentials() else "Mock")

    full_path = os.path.join(PROJECT_ROOT, req.filePath)
    try:
        with open(full_path, "r") as f:
            source_code = f.read()
        log("📄", "SOURCE FILE READ", path=full_path, length=len(source_code))
    except FileNotFoundError:
        log("❌", "FILE NOT FOUND", path=full_path)
        return {"status": "error", "message": f"File not found: {req.filePath}"}

    try:
        if has_aws_credentials():
            result = generate_code_change(
                component_name=req.componentName,
                file_path=req.filePath,
                source_code=source_code,
                intent=precise_intent,
            )
        else:
            result = generate_code_change_mock(
                component_name=req.componentName,
                file_path=req.filePath,
                source_code=source_code,
                intent=req.intent,
            )

        elapsed = time.time() - t0
        has_code = bool(result.get('modifiedCode'))
        code_len = len(result.get('modifiedCode', ''))
        code_changed = result.get('modifiedCode', '') != source_code
        log("✅", f"CODEGEN RESULT ({elapsed:.1f}s)",
            explanation=result.get('explanation'),
            has_modifiedCode=has_code,
            code_length=code_len,
            actually_different=code_changed,
            mock=result.get('mock', False))

        if not code_changed:
            log("⚠️", "WARNING: Generated code is IDENTICAL — auto-retrying with explicit prompt")
            # Retry with a very explicit instruction
            try:
                retry_result = generate_code_change(
                    component_name=req.componentName,
                    file_path=req.filePath,
                    source_code=source_code,
                    intent=f"IMPORTANT: You MUST make a change. The previous attempt returned identical code. "
                           f"The user wants: {req.intent}. "
                           f"You MUST modify the source code to fulfill this request. "
                           f"Do NOT return the original unchanged.",
                )
                retry_changed = retry_result.get('modifiedCode', '') != source_code
                if retry_changed:
                    log("✅", "RETRY SUCCEEDED — code is now different")
                    result = retry_result
                else:
                    log("❌", "RETRY ALSO RETURNED IDENTICAL CODE")
            except Exception as retry_err:
                log("❌", "RETRY FAILED", error=str(retry_err))

        return {
            "status": "ok",
            "generation": result,
            "originalCode": source_code,
        }
    except Exception as e:
        elapsed = time.time() - t0
        log("❌", f"CODEGEN ERROR ({elapsed:.1f}s) — falling back to mock",
            error=f"{type(e).__name__}: {e}")
        traceback.print_exc()
        result = generate_code_change_mock(
            component_name=req.componentName,
            file_path=req.filePath,
            source_code=source_code,
            intent=req.intent,
        )
        result["error"] = str(e)
        result["fallback"] = True
        return {"status": "ok", "generation": result, "originalCode": source_code}


# ========== Code Application ==========

class ApplyRequest(BaseModel):
    filePath: str
    modifiedCode: str
    originalCode: Optional[str] = None
    explanation: Optional[str] = None


@app.post("/api/apply-code")
async def apply_code(req: ApplyRequest):
    """Write modified code to the source file and let Vite HMR pick it up."""
    full_path = os.path.join(PROJECT_ROOT, req.filePath)
    log("🔧", "APPLY CODE",
        file=req.filePath,
        full_path=full_path,
        modifiedCode_length=len(req.modifiedCode),
        explanation=req.explanation or "(none)")

    try:
        with open(full_path, "r") as f:
            current_content = f.read()

        changed = current_content != req.modifiedCode
        log("📝", "FILE DIFF CHECK",
            current_length=len(current_content),
            new_length=len(req.modifiedCode),
            actually_changed=changed)

        if not changed:
            log("⚠️", "NO CHANGES — the generated code is identical to current file!")
            return {
                "status": "ok",
                "message": f"No changes detected in {req.filePath} — code was identical",
                "unchanged": True,
                "undoAvailable": len(undo_stack) > 0,
            }

        undo_stack.append({
            "filePath": req.filePath,
            "previousContent": current_content,
            "explanation": req.explanation or "Code change",
        })

        if len(undo_stack) > 20:
            undo_stack.pop(0)

        with open(full_path, "w") as f:
            f.write(req.modifiedCode)

        log("✅", "FILE WRITTEN", path=req.filePath, changed=changed)

        return {
            "status": "ok",
            "message": f"Applied changes to {req.filePath}",
            "undoAvailable": True,
        }
    except Exception as e:
        log("❌", "APPLY ERROR", error=str(e))
        return {"status": "error", "message": str(e)}


# ========== Undo ==========

@app.post("/api/undo")
async def undo_last():
    """Undo the last code change."""
    if not undo_stack:
        return {"status": "error", "message": "Nothing to undo"}

    entry = undo_stack.pop()
    full_path = os.path.join(PROJECT_ROOT, entry["filePath"])

    try:
        with open(full_path, "w") as f:
            f.write(entry["previousContent"])

        return {
            "status": "ok",
            "message": f"Undid change to {entry['filePath']}",
            "explanation": entry["explanation"],
            "undoAvailable": len(undo_stack) > 0,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ========== Component Source (Read) ==========

@app.get("/api/component-source/{component_name}")
async def get_component_source(component_name: str):
    """Read the source code of a component file."""
    file_path = None
    for _key, info in COMPONENT_REGISTRY.items():
        if info["name"] == component_name:
            file_path = info["filePath"]
            break

    if not file_path:
        return {"status": "error", "message": f"Component '{component_name}' not found"}

    full_path = os.path.join(PROJECT_ROOT, file_path)
    try:
        with open(full_path, "r") as f:
            source = f.read()
        return {"status": "ok", "filePath": file_path, "source": source}
    except FileNotFoundError:
        return {"status": "error", "message": f"File not found: {file_path}"}


# ========== Verification ==========

class VerifyRequest(BaseModel):
    expectedChange: str
    componentName: str = ""
    appUrl: str = "http://localhost:5173"
    screenshotBase64: Optional[str] = None
    targetElement: Optional[str] = None  # e.g. "Chart footer info"


@app.post("/api/verify")
async def verify_ui(req: VerifyRequest):
    """Verify a UI change using Nova Act or Nova Lite Vision."""
    log("🔍", "VERIFY",
        change=req.expectedChange[:100],
        component=req.componentName,
        target=req.targetElement or "(whole component)")

    result = verify_change(
        expected_change=req.expectedChange,
        app_url=req.appUrl,
        component_name=req.componentName,
        screenshot_base64=req.screenshotBase64,
        target_element=req.targetElement,
    )

    log("✅" if result.get("verified") else "❌", "VERIFY RESULT",
        method=result.get("method", "unknown"),
        verified=result.get("verified", False),
        reason=result.get("reason", "")[:100])

    return {"status": "ok", "verification": result}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("SERVER_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
