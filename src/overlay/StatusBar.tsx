import { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faMicrophone,
    faStop,
    faCamera,
    faCrosshairs,
    faCode,
    faWrench,
    faCheck,
    faVolumeHigh,
    faSpinner,
    faSearch,
} from '@fortawesome/free-solid-svg-icons';
import { Chip } from '@mui/material';
import type { PipelineStatus } from '../types';
import type { VoiceStatus } from '../voice/VoiceCapture';

interface StatusBarProps {
    status: PipelineStatus;
    lastCommand: string | null;
    voiceStatus?: VoiceStatus;
    interimText?: string;
    onVoiceToggle?: () => void;
}

export function StatusBar({
    status,
    lastCommand,
    voiceStatus = 'idle',
    interimText = '',
    onVoiceToggle,
}: StatusBarProps) {
    // Keyboard shortcut: Space to toggle voice (when not typing)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                onVoiceToggle?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onVoiceToggle]);

    const getStatusConfig = () => {
        if (voiceStatus === 'listening') {
            return {
                icon: faMicrophone,
                text: interimText || 'Listening — speak a command...',
                color: 'var(--accent-primary)',
            };
        }
        if (voiceStatus === 'processing') {
            return { icon: faSpinner, text: 'Processing voice command...', color: 'var(--accent-purple)' };
        }
        if (voiceStatus === 'speaking') {
            return { icon: faVolumeHigh, text: 'Speaking confirmation...', color: 'var(--accent-emerald)' };
        }
        if (status === 'capturing') return { icon: faCamera, text: 'Capturing screenshot...', color: 'var(--accent-primary)' };
        if (status === 'grounding') return { icon: faCrosshairs, text: 'Identifying component...', color: 'var(--accent-purple)' };
        if (status === 'generating') return { icon: faCode, text: 'Nova Premier generating code...', color: '#3b82f6' };
        if (status === 'applying') return { icon: faWrench, text: 'Applying changes...', color: 'var(--accent-primary)' };
        if (status === 'verifying') return { icon: faSearch, text: 'Nova Act verifying UI...', color: 'var(--accent-blue)' };
        if (status === 'confirming') return { icon: faVolumeHigh, text: 'Confirming change...', color: 'var(--accent-emerald)' };
        if (lastCommand) return { icon: faCheck, text: lastCommand, color: 'var(--accent-emerald)' };
        return { icon: faCrosshairs, text: 'Ready — Click a UI element or point to start', color: 'var(--text-muted)' };
    };

    const config = getStatusConfig();

    const getIndicatorClass = () => {
        if (voiceStatus === 'listening') return 'listening';
        if (voiceStatus === 'processing' || (status !== 'idle' && status !== 'listening')) return 'processing';
        return '';
    };

    return (
        <div className="status-bar" data-component="status-bar">
            <div className={`status-indicator ${getIndicatorClass()}`} />
            <FontAwesomeIcon
                icon={config.icon}
                style={{
                    color: config.color,
                    fontSize: '0.7rem',
                    marginRight: 6,
                    ...(voiceStatus === 'processing' || (status !== 'idle' && status !== 'listening' && status !== 'confirming')
                        ? { animation: 'spin 1s linear infinite' }
                        : {}),
                }}
            />
            <span>{config.text}</span>

            <div style={{ flex: 1 }} />

            {/* Keyboard shortcut hint */}
            {voiceStatus === 'idle' && status === 'idle' && (
                <span style={{
                    fontSize: '0.6rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                }}>
                    Press <kbd style={{
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-glass)',
                        fontSize: '0.55rem',
                        fontFamily: 'var(--font-mono)',
                    }}>Space</kbd> to speak
                </span>
            )}

            {onVoiceToggle && (
                <Chip
                    icon={
                        <FontAwesomeIcon
                            icon={voiceStatus === 'listening' ? faStop : faMicrophone}
                            style={{ fontSize: '0.6rem', color: voiceStatus === 'listening' ? '#0c0c14' : 'var(--text-secondary)' }}
                        />
                    }
                    label={voiceStatus === 'listening' ? 'Stop' : 'Speak'}
                    size="small"
                    onClick={onVoiceToggle}
                    sx={{
                        ml: 1,
                        background: voiceStatus === 'listening' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                        color: voiceStatus === 'listening' ? '#0c0c14' : 'var(--text-secondary)',
                        border: '1px solid var(--border-glass)',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 26,
                        cursor: 'pointer',
                        transition: 'all 200ms ease',
                        '&:hover': {
                            background: voiceStatus === 'listening'
                                ? 'var(--accent-primary)'
                                : 'rgba(255,255,255,0.06)',
                        },
                    }}
                />
            )}
        </div>
    );
}
