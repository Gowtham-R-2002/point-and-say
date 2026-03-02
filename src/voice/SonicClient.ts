/**
 * SonicClient — Frontend client for Nova Sonic voice I/O
 *
 * Handles:
 * - Audio recording from the browser microphone
 * - Sending audio to the backend /api/sonic/transcribe endpoint
 * - Playing back audio responses from Nova Sonic
 * - Falling back to Web Speech API when Sonic is unavailable
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface SonicTranscriptionResult {
    transcription: string;
    audioResponse?: string; // base64 audio
    mock: boolean;
    fallback: boolean;
    error?: string;
}

export interface SonicSpeechResult {
    audioBase64: string | null;
    format: string;
    engine: string;
    mock: boolean;
}

/**
 * Record audio from the microphone for a specified duration.
 * Returns base64-encoded PCM audio (16-bit, 16kHz, mono).
 */
export async function recordAudio(durationMs: number = 5000): Promise<string> {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
        },
    });

    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    const audioChunks: Float32Array[] = [];

    return new Promise((resolve, _reject) => {
        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            audioChunks.push(new Float32Array(inputData));
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        const timeout = setTimeout(() => {
            cleanup();
            const pcmBase64 = float32ToPCMBase64(audioChunks);
            resolve(pcmBase64);
        }, durationMs);

        const cleanup = () => {
            clearTimeout(timeout);
            processor.disconnect();
            source.disconnect();
            audioContext.close();
            stream.getTracks().forEach(track => track.stop());
        };
    });
}

/**
 * Record audio using MediaRecorder for push-to-talk.
 * Records until `stop()` is called on the returned controller.
 */
export function createPushToTalkRecorder(): {
    start: () => Promise<void>;
    stop: () => Promise<string>;
} {
    let mediaRecorder: MediaRecorder | null = null;
    let resolvePromise: ((audio: string) => void) | null = null;
    let chunks: Blob[] = [];

    return {
        start: async () => {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });

            chunks = [];
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/webm',
            });

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const base64 = await blobToBase64(blob);
                if (resolvePromise) {
                    resolvePromise(base64);
                    resolvePromise = null;
                }
            };

            mediaRecorder.start(100); // Collect data every 100ms
        },

        stop: () => {
            return new Promise((resolve) => {
                resolvePromise = resolve;
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                } else {
                    resolve('');
                }
            });
        },
    };
}

/**
 * Send audio to the backend for Nova Sonic transcription.
 */
export async function transcribeWithSonic(audioBase64: string): Promise<SonicTranscriptionResult> {
    try {
        const response = await fetch(`${API_BASE}/api/sonic/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64 }),
        });

        if (!response.ok) {
            throw new Error(`Sonic API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            transcription: data.transcription || '',
            audioResponse: data.audioResponse || undefined,
            mock: data.mock || false,
            fallback: data.fallback || false,
            error: data.error || undefined,
        };
    } catch (err) {
        return {
            transcription: '',
            mock: false,
            fallback: true,
            error: err instanceof Error ? err.message : 'Failed to reach Sonic API',
        };
    }
}

/**
 * Request Nova Sonic to generate speech from text.
 */
export async function speakWithSonic(text: string): Promise<SonicSpeechResult> {
    try {
        const response = await fetch(`${API_BASE}/api/sonic/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error(`TTS speak error: ${response.status}`);
        }

        const data = await response.json();
        return {
            audioBase64: data.audioBase64 || null,
            format: data.format || 'audio/mpeg',
            engine: data.engine || 'browser',
            mock: data.mock || false,
        };
    } catch {
        return { audioBase64: null, format: 'audio/mpeg', engine: 'browser', mock: true };
    }
}

/**
 * Play base64-encoded audio in the browser.
 * Supports PCM and WebM formats.
 */
export async function playAudio(base64Audio: string, format: string = 'audio/wav'): Promise<void> {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: format });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    return new Promise((resolve, reject) => {
        audio.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
        };
        audio.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Audio playback failed'));
        };
        audio.play().catch(reject);
    });
}

// ---- Utility Functions ----

/** Convert Float32Array audio chunks to PCM 16-bit base64 */
function float32ToPCMBase64(chunks: Float32Array[]): string {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const pcm = new Int16Array(totalLength);

    let offset = 0;
    for (const chunk of chunks) {
        for (let i = 0; i < chunk.length; i++) {
            const sample = Math.max(-1, Math.min(1, chunk[i]));
            pcm[offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
    }

    const bytes = new Uint8Array(pcm.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/** Convert Blob to base64 string */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1] || '';
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
