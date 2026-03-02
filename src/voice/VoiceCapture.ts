/**
 * VoiceCapture — Hybrid voice command capture
 *
 * Uses the Web Speech API (SpeechRecognition) for real-time voice input.
 * Uses Nova Sonic via /api/sonic/speak for voice output (TTS).
 * Falls back to browser TTS when Sonic is unavailable.
 */

import { speakWithSonic, playAudio } from './SonicClient';

export type VoiceMode = 'push-to-talk' | 'continuous';
export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceCommand {
    text: string;
    confidence: number;
    timestamp: number;
    isFinal: boolean;
}

export type VoiceCommandCallback = (command: VoiceCommand) => void;
export type VoiceStatusCallback = (status: VoiceStatus) => void;

export class VoiceCapture {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private recognition: any = null;
    private synth: SpeechSynthesis;
    private onCommand: VoiceCommandCallback;
    private onStatusChange: VoiceStatusCallback;
    private mode: VoiceMode;
    private _status: VoiceStatus = 'idle';
    private restartTimeout: number | null = null;

    constructor(
        onCommand: VoiceCommandCallback,
        onStatusChange: VoiceStatusCallback,
        mode: VoiceMode = 'push-to-talk'
    ) {
        this.onCommand = onCommand;
        this.onStatusChange = onStatusChange;
        this.mode = mode;
        this.synth = window.speechSynthesis;
        this.initRecognition();
    }

    get status() {
        return this._status;
    }

    get isSupported() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
    }

    private setStatus(status: VoiceStatus) {
        this._status = status;
        this.onStatusChange(status);
    }

    private initRecognition() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

        if (!SpeechRecognitionClass) {
            console.warn('SpeechRecognition API not available in this browser');
            return;
        }

        const recognition = new SpeechRecognitionClass();
        recognition.continuous = this.mode === 'continuous';
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            this.setStatus('listening');
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.trim();
            const confidence = result[0].confidence;
            const isFinal = result.isFinal;

            this.onCommand({
                text: transcript,
                confidence,
                timestamp: Date.now(),
                isFinal,
            });

            // In push-to-talk mode, auto-transition on final result
            if (isFinal && this.mode === 'push-to-talk') {
                this.setStatus('processing');
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);

            // 'no-speech' and 'aborted' are normal operational states
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                this.setStatus('error');
            }
        };

        recognition.onend = () => {
            // In continuous mode, auto-restart unless explicitly stopped
            if (this.mode === 'continuous' && this._status === 'listening') {
                this.restartTimeout = window.setTimeout(() => {
                    try {
                        this.recognition?.start();
                    } catch {
                        // Already started, ignore
                    }
                }, 100);
            } else if (this._status !== 'processing' && this._status !== 'speaking') {
                this.setStatus('idle');
            }
        };

        this.recognition = recognition;
    }

    /** Start listening for voice commands. */
    startListening() {
        if (!this.recognition) {
            this.setStatus('error');
            return;
        }

        try {
            this.recognition.start();
        } catch {
            this.recognition.stop();
            setTimeout(() => {
                try {
                    this.recognition?.start();
                } catch {
                    // ignore
                }
            }, 100);
        }
    }

    /** Stop listening. */
    stopListening() {
        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }

        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch {
                // ignore
            }
        }
        this.setStatus('idle');
    }

    /** Toggle listening on/off. */
    toggleListening() {
        if (this._status === 'listening') {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    /**
     * Speak a confirmation message.
     * Tries Nova Sonic first, falls back to browser TTS.
     */
    async speak(text: string): Promise<void> {
        this.setStatus('speaking');

        try {
            // Try Polly/Sonic (backend decides priority)
            const sonicResult = await speakWithSonic(text);

            if (sonicResult.audioBase64 && !sonicResult.mock) {
                // Play audio with correct format (MP3 from Polly, WAV from Sonic)
                console.log(`[Voice] Playing audio from ${sonicResult.engine} (${sonicResult.format})`);
                await playAudio(sonicResult.audioBase64, sonicResult.format);
                this.setStatus('idle');
                return;
            }
        } catch (err) {
            console.warn('TTS API failed, falling back to browser TTS:', err);
        }

        // Fallback: browser TTS
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.1;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;

            const voices = this.synth.getVoices();
            const preferred = voices.find(
                (v) => v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Natural')
            );
            if (preferred) utterance.voice = preferred;

            utterance.onend = () => {
                this.setStatus('idle');
                resolve();
            };

            utterance.onerror = () => {
                this.setStatus('idle');
                resolve();
            };

            this.synth.speak(utterance);
        });
    }

    /** Set the voice mode. */
    setMode(mode: VoiceMode) {
        const wasListening = this._status === 'listening';
        if (wasListening) this.stopListening();

        this.mode = mode;
        if (this.recognition) {
            this.recognition.continuous = mode === 'continuous';
        }

        if (wasListening) this.startListening();
    }

    /** Clean up. */
    destroy() {
        this.stopListening();
        this.synth.cancel();
        this.recognition = null;
    }
}
