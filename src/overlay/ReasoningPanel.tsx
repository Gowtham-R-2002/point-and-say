import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBrain,
    faEye,
    faCrosshairs,
    faMicrophone,
    faCode,
    faWrench,
    faVolumeHigh,
    faCheck,
    faCircleExclamation,
    faSpinner,
    faHandPointer,
    faUndo,
    faTrash,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { IconButton, CircularProgress } from '@mui/material';
import type { ReasoningStep, PipelineStatus } from '../types';

interface ReasoningPanelProps {
    steps: ReasoningStep[];
    status: PipelineStatus;
    onClear: () => void;
}

/** Map agent type to a Font Awesome icon */
const agentIcons: Record<string, IconDefinition> = {
    vision: faEye,
    grounding: faCrosshairs,
    voice: faMicrophone,
    codegen: faCode,
    apply: faWrench,
    confirm: faVolumeHigh,
    undo: faUndo,
};

const statusIcon = (s: ReasoningStep['status']) => {
    switch (s) {
        case 'completed':
            return <FontAwesomeIcon icon={faCheck} style={{ color: 'var(--accent-emerald)', fontSize: '0.65rem' }} />;
        case 'error':
            return <FontAwesomeIcon icon={faCircleExclamation} style={{ color: '#ef4444', fontSize: '0.65rem' }} />;
        case 'in-progress':
            return <CircularProgress size={12} sx={{ color: 'var(--accent-primary)' }} />;
        default:
            return <FontAwesomeIcon icon={faSpinner} style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }} />;
    }
};

export function ReasoningPanel({ steps, status, onClear }: ReasoningPanelProps) {
    return (
        <aside className="reasoning-panel">
            <div className="reasoning-header">
                <FontAwesomeIcon icon={faBrain} style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }} />
                <span>Agent Reasoning</span>
                {steps.length > 0 && (
                    <IconButton
                        onClick={onClear}
                        size="small"
                        sx={{
                            ml: 'auto',
                            color: 'var(--text-muted)',
                            fontSize: '0.7rem',
                            '&:hover': { color: 'var(--text-primary)' },
                        }}
                    >
                        <FontAwesomeIcon icon={faTrash} style={{ fontSize: '0.6rem' }} />
                    </IconButton>
                )}
            </div>

            <div className="reasoning-steps">
                {steps.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.8rem',
                        padding: 'var(--space-xl) 0',
                    }}>
                        <FontAwesomeIcon
                            icon={faHandPointer}
                            style={{
                                fontSize: '1.5rem',
                                marginBottom: 'var(--space-sm)',
                                color: 'var(--accent-primary)',
                                opacity: 0.6,
                            }}
                        />
                        <p>Click on a UI element and speak a command to get started</p>
                        <p style={{ marginTop: 'var(--space-sm)', fontSize: '0.7rem' }}>
                            Try: "Make this button blue"
                        </p>
                    </div>
                ) : (
                    steps.map((step) => (
                        <div
                            key={step.id}
                            className={`reasoning-step ${step.status}`}
                        >
                            <div className="step-icon">
                                <FontAwesomeIcon
                                    icon={agentIcons[step.agent] || faEye}
                                    style={{ fontSize: '0.7rem' }}
                                />
                            </div>
                            <div className="step-content">
                                <div className="step-agent">{step.agentLabel}</div>
                                <div className="step-message">{step.message}</div>
                                {step.details && (
                                    <div className="step-message" style={{
                                        marginTop: '4px',
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted)',
                                    }}>
                                        {step.details}
                                    </div>
                                )}
                            </div>
                            <div className="step-status">
                                {statusIcon(step.status)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {status !== 'idle' && (
                <div style={{
                    marginTop: 'auto',
                    paddingTop: 'var(--space-md)',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                }}>
                    <CircularProgress size={10} sx={{ color: 'var(--accent-primary)' }} />
                    Pipeline: {status}
                </div>
            )}
        </aside>
    );
}
