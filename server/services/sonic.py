"""
Nova Sonic Service — Speech-to-Speech via Amazon Bedrock

Uses the InvokeModelWithBidirectionalStream API to handle real-time
voice I/O with Nova Sonic (amazon.nova-sonic-v1:0).

Architecture:
  Browser (mic audio) → WebSocket → FastAPI → Nova Sonic Bidirectional Stream
  Nova Sonic → (transcription + audio) → FastAPI → WebSocket → Browser (speaker)
"""
import asyncio
import base64
import json
import os
import uuid
from typing import Optional

# Try the experimental SDK first, fall back to boto3
try:
    from aws_sdk_bedrock_runtime import BedrockRuntimeClient, InvokeModelWithBidirectionalStreamOperationInput
    HAS_SONIC_SDK = True
except ImportError:
    HAS_SONIC_SDK = False

import boto3

NOVA_SONIC_MODEL_ID = "amazon.nova-sonic-v1:0"
AUDIO_SAMPLE_RATE = 16000
AUDIO_ENCODING = "pcm"  # 16-bit PCM

def get_bedrock_client():
    """Create a Bedrock Runtime client for Nova Sonic."""
    region = os.getenv("BEDROCK_REGION", os.getenv("AWS_REGION", "us-east-1"))
    return boto3.client(
        "bedrock-runtime",
        region_name=region,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )


class NovaSonicSession:
    """
    Manages a single Nova Sonic bidirectional streaming session.
    
    Handles:
    - Session setup with system prompt
    - Streaming audio input
    - Receiving transcription + audio output
    """
    
    def __init__(self, system_prompt: str = ""):
        self.session_id = str(uuid.uuid4())
        self.prompt_id = str(uuid.uuid4())
        self.content_id = str(uuid.uuid4())
        self.system_prompt = system_prompt or (
            "You are a helpful UI assistant called Nova. "
            "You help developers modify user interfaces by voice commands. "
            "Keep responses short, friendly, and conversational. "
            "When confirming a change, briefly describe what was done."
        )
        self.client = get_bedrock_client()
        self.is_active = False
        self._transcription = ""
        self._audio_chunks: list[bytes] = []
    
    async def transcribe_audio(self, audio_base64: str) -> dict:
        """
        Send audio to Nova Sonic and get transcription + spoken response.
        
        For the hackathon, we use a simplified request-response pattern:
        1. Send audio as a single chunk
        2. Get transcription text back
        3. Optionally get audio response
        
        Args:
            audio_base64: Base64-encoded PCM audio (16kHz, 16-bit, mono)
            
        Returns:
            dict with 'transcription' and optionally 'audioResponse' (base64)
        """
        try:
            return await self._invoke_sonic(audio_base64)
        except Exception as e:
            print(f"[SONIC] Error: {e}")
            # Fall back to returning an error
            return {
                "transcription": "",
                "error": str(e),
                "mock": False,
            }
    
    async def generate_speech(self, text: str) -> Optional[str]:
        """
        Generate speech audio from text using Nova Sonic.
        
        Uses a text-to-speech mode by sending text input and requesting audio output.
        
        Args:
            text: Text to convert to speech
            
        Returns:
            Base64-encoded audio (PCM) or None on failure
        """
        try:
            return await self._text_to_speech(text)
        except Exception as e:
            print(f"[SONIC TTS] Error: {e}")
            return None
    
    async def _invoke_sonic(self, audio_base64: str) -> dict:
        """
        Invoke Nova Sonic with audio input using the Converse Stream API.
        Uses boto3's bedrock-runtime for compatibility.
        """
        # Build the events for the bidirectional stream
        # Nova Sonic expects specific event sequence:
        # 1. sessionStart
        # 2. promptStart  
        # 3. contentStart (system prompt)
        # 4. textInput (system prompt text)
        # 5. contentEnd
        # 6. contentStart (audio)
        # 7. audioInput (audio chunks)
        # 8. contentEnd
        # 9. promptEnd
        
        events = self._build_input_events(audio_base64)
        
        transcription = ""
        audio_response_chunks = []
        
        try:
            # Use invoke_model_with_response_stream as a simpler alternative
            # that works with standard boto3
            response = self.client.invoke_model_with_response_stream(
                modelId=NOVA_SONIC_MODEL_ID,
                contentType="application/json",
                accept="application/json",
                body=json.dumps({
                    "inferenceConfig": {
                        "maxTokens": 1024,
                    },
                    "audioConfig": {
                        "sampleRate": AUDIO_SAMPLE_RATE,
                        "encoding": AUDIO_ENCODING,
                    },
                    "systemPrompt": self.system_prompt,
                    "audioInput": audio_base64,
                }),
            )
            
            # Process streaming response
            for event in response.get("body", []):
                chunk = event.get("chunk", {})
                if chunk:
                    payload = json.loads(chunk.get("bytes", b"{}"))
                    
                    if "transcription" in payload:
                        transcription = payload["transcription"]
                    
                    if "audioOutput" in payload:
                        audio_response_chunks.append(payload["audioOutput"])
            
            audio_response = "".join(audio_response_chunks) if audio_response_chunks else None
            
            return {
                "transcription": transcription,
                "audioResponse": audio_response,
                "mock": False,
            }
            
        except self.client.exceptions.ValidationException as e:
            # Model might not support this exact API format
            # Fall back to basic transcription
            print(f"[SONIC] Validation error, trying alternative: {e}")
            return await self._fallback_transcribe(audio_base64)
        except Exception as e:
            print(f"[SONIC] Stream error: {e}")
            return await self._fallback_transcribe(audio_base64)
    
    async def _text_to_speech(self, text: str) -> Optional[str]:
        """Generate speech from text using Nova Sonic."""
        try:
            response = self.client.invoke_model_with_response_stream(
                modelId=NOVA_SONIC_MODEL_ID,
                contentType="application/json",
                accept="application/json",
                body=json.dumps({
                    "textInput": text,
                    "audioConfig": {
                        "sampleRate": AUDIO_SAMPLE_RATE,
                        "encoding": AUDIO_ENCODING,
                    },
                }),
            )
            
            audio_chunks = []
            for event in response.get("body", []):
                chunk = event.get("chunk", {})
                if chunk:
                    payload = json.loads(chunk.get("bytes", b"{}"))
                    if "audioOutput" in payload:
                        audio_chunks.append(payload["audioOutput"])
            
            return "".join(audio_chunks) if audio_chunks else None
            
        except Exception as e:
            print(f"[SONIC TTS] Error: {e}")
            return None
    
    async def _fallback_transcribe(self, audio_base64: str) -> dict:
        """
        Fallback: use Amazon Transcribe or return empty.
        For hackathon, we return empty transcription and let the frontend
        fall back to Web Speech API.
        """
        return {
            "transcription": "",
            "error": "Nova Sonic bidirectional stream not available, using Web Speech API fallback",
            "mock": False,
            "fallback": True,
        }
    
    def _build_input_events(self, audio_base64: str) -> list[dict]:
        """Build the sequence of input events for Nova Sonic bidirectional stream."""
        return [
            # Session start
            {
                "event": {
                    "sessionStart": {
                        "inferenceConfiguration": {
                            "maxTokens": 1024,
                        }
                    }
                }
            },
            # Prompt start
            {
                "event": {
                    "promptStart": {
                        "promptName": self.prompt_id,
                        "textOutputConfiguration": {"mediaType": "text/plain"},
                        "audioOutputConfiguration": {
                            "mediaType": "audio/lpcm",
                            "sampleRateHertz": AUDIO_SAMPLE_RATE,
                            "sampleSizeBits": 16,
                            "channelCount": 1,
                        },
                    }
                }
            },
            # System prompt
            {
                "event": {
                    "contentStart": {
                        "promptName": self.prompt_id,
                        "contentName": f"{self.content_id}-system",
                        "type": "TEXT",
                        "interactive": False,
                        "role": "SYSTEM",
                        "textInputConfiguration": {"mediaType": "text/plain"},
                    }
                }
            },
            {
                "event": {
                    "textInput": {
                        "promptName": self.prompt_id,
                        "contentName": f"{self.content_id}-system",
                        "content": self.system_prompt,
                    }
                }
            },
            {
                "event": {
                    "contentEnd": {
                        "promptName": self.prompt_id,
                        "contentName": f"{self.content_id}-system",
                    }
                }
            },
            # Audio input
            {
                "event": {
                    "contentStart": {
                        "promptName": self.prompt_id,
                        "contentName": f"{self.content_id}-audio",
                        "type": "AUDIO",
                        "interactive": True,
                        "role": "USER",
                        "audioInputConfiguration": {
                            "mediaType": "audio/lpcm",
                            "sampleRateHertz": AUDIO_SAMPLE_RATE,
                            "sampleSizeBits": 16,
                            "channelCount": 1,
                            "encoding": AUDIO_ENCODING,
                        },
                    }
                }
            },
            {
                "event": {
                    "audioInput": {
                        "promptName": self.prompt_id,
                        "contentName": f"{self.content_id}-audio",
                        "content": audio_base64,
                    }
                }
            },
            {
                "event": {
                    "contentEnd": {
                        "promptName": self.prompt_id,
                        "contentName": f"{self.content_id}-audio",
                    }
                }
            },
            # Prompt end
            {
                "event": {
                    "promptEnd": {
                        "promptName": self.prompt_id,
                    }
                }
            },
        ]


# Mock session for development without AWS credentials
class MockNovaSonicSession:
    """Mock Nova Sonic session that returns empty results."""
    
    async def transcribe_audio(self, audio_base64: str) -> dict:
        return {
            "transcription": "",
            "mock": True,
            "fallback": True,
            "error": "Mock mode — using Web Speech API fallback",
        }
    
    async def generate_speech(self, text: str) -> Optional[str]:
        return None


def create_sonic_session(system_prompt: str = "") -> NovaSonicSession | MockNovaSonicSession:
    """Create a Nova Sonic session, or mock if credentials unavailable."""
    if os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("AWS_PROFILE"):
        try:
            return NovaSonicSession(system_prompt)
        except Exception as e:
            print(f"[SONIC] Failed to create session, using mock: {e}")
            return MockNovaSonicSession()
    return MockNovaSonicSession()
