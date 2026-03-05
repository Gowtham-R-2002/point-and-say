"""
Amazon Polly TTS Service — Natural Voice Output

Uses Amazon Polly with neural voices for high-quality text-to-speech.
Much better than browser SpeechSynthesis — sounds natural and human-like.

Uses the same AWS credentials as the rest of the app.
"""
import os
import base64
import boto3
from typing import Optional


# Neural voices ranked by quality for US English
PREFERRED_VOICES = [
    ("Ruth", "generative"),     # Best: Generative engine (most natural)
    ("Matthew", "generative"),  # Generative male voice
    ("Ruth", "neural"),         # Neural engine (very good)
    ("Joanna", "neural"),       # Classic neural female voice
    ("Matthew", "neural"),      # Classic neural male voice
    ("Amy", "neural"),          # British neural
]

# Default voice config
DEFAULT_VOICE_ID = os.getenv("POLLY_VOICE_ID", "Ruth")
DEFAULT_ENGINE = os.getenv("POLLY_ENGINE", "generative")


def get_polly_client():
    """Create an Amazon Polly client."""
    region = os.getenv("AWS_REGION", "us-east-1")
    return boto3.client(
        "polly",
        region_name=region,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )


def synthesize_speech(
    text: str,
    voice_id: str = DEFAULT_VOICE_ID,
    engine: str = DEFAULT_ENGINE,
    output_format: str = "mp3",
) -> Optional[str]:
    """
    Convert text to speech using Amazon Polly.

    Args:
        text: Text to speak (max 3000 chars)
        voice_id: Polly voice ID (Ruth, Matthew, Joanna, etc.)
        engine: 'generative', 'neural', or 'standard'
        output_format: 'mp3', 'ogg_vorbis', or 'pcm'

    Returns:
        Base64-encoded audio string, or None on failure
    """
    if not text or not text.strip():
        return None

    # Truncate long text to Polly's limit
    if len(text) > 3000:
        text = text[:2990] + "..."

    client = get_polly_client()

    # Try the preferred engine, fall back if unavailable
    for try_engine in _get_engine_fallbacks(engine):
        try:
            response = client.synthesize_speech(
                Text=text,
                OutputFormat=output_format,
                VoiceId=voice_id,
                Engine=try_engine,
                LanguageCode="en-US",
            )

            # Read the audio stream
            audio_stream = response.get("AudioStream")
            if audio_stream:
                audio_bytes = audio_stream.read()
                audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
                print(f"[POLLY] Synthesized {len(text)} chars → {len(audio_bytes)} bytes "
                      f"({voice_id}/{try_engine}/{output_format})")
                return audio_base64
            else:
                print("[POLLY] No audio stream in response")
                return None

        except client.exceptions.InvalidParameterValueException as e:
            # Engine/voice combo not available, try next
            print(f"[POLLY] {voice_id}/{try_engine} not available: {e}")
            continue
        except Exception as e:
            print(f"[POLLY] Error with {voice_id}/{try_engine}: {e}")
            # If it's an access error, don't retry with different engines
            if "AccessDenied" in str(e) or "not authorized" in str(e).lower():
                return None
            continue

    print(f"[POLLY] All engine fallbacks failed for voice {voice_id}")
    return None


def _get_engine_fallbacks(preferred: str) -> list[str]:
    """Get ordered list of engines to try."""
    engines = ["generative", "neural", "standard"]
    if preferred in engines:
        engines.remove(preferred)
        return [preferred] + engines
    return engines


def list_available_voices() -> list[dict]:
    """List available Polly voices (for debugging/configuration)."""
    try:
        client = get_polly_client()
        response = client.describe_voices(LanguageCode="en-US")
        voices = []
        for voice in response.get("Voices", []):
            voices.append({
                "id": voice["Id"],
                "name": voice["Name"],
                "gender": voice["Gender"],
                "engines": voice.get("SupportedEngines", []),
            })
        return voices
    except Exception as e:
        print(f"[POLLY] Error listing voices: {e}")
        return []
