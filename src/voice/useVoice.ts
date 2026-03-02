/**
 * useVoice — React hook wrapping VoiceCapture
 *
 * Provides voice command capture, status tracking, TTS confirmation,
 * and command history.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { VoiceCapture } from './VoiceCapture';
import type { VoiceCommand, VoiceStatus, VoiceMode } from './VoiceCapture';

export interface UseVoiceReturn {
    voiceStatus: VoiceStatus;
    lastCommand: VoiceCommand | null;
    interimText: string;
    commandHistory: VoiceCommand[];
    isSupported: boolean;
    toggleListening: () => void;
    startListening: () => void;
    stopListening: () => void;
    speak: (text: string) => Promise<void>;
    setMode: (mode: VoiceMode) => void;
}

export function useVoice(): UseVoiceReturn {
    const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
    const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
    const [interimText, setInterimText] = useState('');
    const [commandHistory, setCommandHistory] = useState<VoiceCommand[]>([]);
    const captureRef = useRef<VoiceCapture | null>(null);

    // Initialize on mount
    useEffect(() => {
        const capture = new VoiceCapture(
            // Command callback
            (command) => {
                if (command.isFinal) {
                    setLastCommand(command);
                    setInterimText('');
                    setCommandHistory((prev) => [...prev.slice(-9), command]);
                } else {
                    setInterimText(command.text);
                }
            },
            // Status callback
            (status) => {
                setVoiceStatus(status);
            },
            'push-to-talk'
        );

        captureRef.current = capture;

        return () => {
            capture.destroy();
        };
    }, []);

    const toggleListening = useCallback(() => {
        captureRef.current?.toggleListening();
    }, []);

    const startListening = useCallback(() => {
        captureRef.current?.startListening();
    }, []);

    const stopListening = useCallback(() => {
        captureRef.current?.stopListening();
    }, []);

    const speak = useCallback(async (text: string) => {
        await captureRef.current?.speak(text);
    }, []);

    const setMode = useCallback((mode: VoiceMode) => {
        captureRef.current?.setMode(mode);
    }, []);

    const isSupported = captureRef.current?.isSupported ?? true;

    return {
        voiceStatus,
        lastCommand,
        interimText,
        commandHistory,
        isSupported,
        toggleListening,
        startListening,
        stopListening,
        speak,
        setMode,
    };
}
