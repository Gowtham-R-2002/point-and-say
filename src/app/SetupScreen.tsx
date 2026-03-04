/**
 * SetupScreen — Project configuration screen
 *
 * Shown before the main dashboard. Allows the user to configure:
 * - Project root folder path
 * - Dev server URL
 * - Auto-detects framework and scans for components
 *
 * Pre-filled with the built-in dashboard for quick demo starts.
 */
import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFolderOpen,
    faGlobe,
    faSearch,
    faRocket,
    faCheckCircle,
    faExclamationTriangle,
    faSpinner,
    faBolt,
    faCode,
    faCubes,
} from '@fortawesome/free-solid-svg-icons';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ScanResult {
    projectPath: string;
    framework: string;
    devCommand: string;
    components: {
        name: string;
        fileName: string;
        filePath: string;
        elementType: string;
        dataAttributes: string[];
        lineCount: number;
    }[];
    totalFiles: number;
    error?: string;
}

interface SetupScreenProps {
    onComplete: () => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
    const [projectPath, setProjectPath] = useState('');
    const [devServerUrl, setDevServerUrl] = useState('http://localhost:5173');
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [error, setError] = useState<string | null>(null);

    // Check backend health on mount
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/health`);
                if (res.ok) {
                    setBackendStatus('online');
                    // Auto-load current project info
                    const infoRes = await fetch(`${API_BASE}/api/project-info`);
                    if (infoRes.ok) {
                        const data = await infoRes.json();
                        if (data.config) {
                            setProjectPath(data.config.projectPath || '');
                            setDevServerUrl(data.config.devServerUrl || 'http://localhost:5173');
                        }
                        if (data.scan) {
                            setScanResult(data.scan);
                        }
                    }
                } else {
                    setBackendStatus('offline');
                }
            } catch {
                setBackendStatus('offline');
            }
        })();
    }, []);

    const handleScan = useCallback(async () => {
        if (!projectPath.trim()) return;
        setIsScanning(true);
        setError(null);
        setScanResult(null);

        try {
            const res = await fetch(`${API_BASE}/api/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath: projectPath.trim(), devServerUrl }),
            });
            const data = await res.json();
            if (data.scan) {
                setScanResult(data.scan);
                if (data.scan.error) {
                    setError(data.scan.error);
                }
            }
        } catch (err) {
            setError('Failed to connect to backend');
        } finally {
            setIsScanning(false);
        }
    }, [projectPath, devServerUrl]);

    const handleConnect = useCallback(async () => {
        if (!projectPath.trim()) return;
        setIsConfiguring(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/api/configure`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath: projectPath.trim(), devServerUrl }),
            });
            const data = await res.json();
            if (data.status === 'ok') {
                onComplete();
            } else {
                setError(data.message || 'Configuration failed');
            }
        } catch {
            setError('Failed to connect to backend');
        } finally {
            setIsConfiguring(false);
        }
    }, [projectPath, devServerUrl, onComplete]);

    // Quick start — use current project
    const handleQuickStart = useCallback(() => {
        if (scanResult && !scanResult.error) {
            handleConnect();
        } else {
            onComplete();
        }
    }, [scanResult, handleConnect, onComplete]);

    return (
        <div className="setup-screen">
            <div className="setup-container">
                {/* Header */}
                <div className="setup-header">
                    <div className="setup-logo">
                        <FontAwesomeIcon icon={faBolt} />
                    </div>
                    <h1 className="setup-title">
                        Point <span className="gradient-text-warm">&</span> Say UI
                    </h1>
                    <p className="setup-subtitle">
                        Configure your project to start editing with voice and gestures
                    </p>
                </div>

                {/* Backend Status */}
                <div className={`setup-status ${backendStatus}`}>
                    <FontAwesomeIcon
                        icon={
                            backendStatus === 'checking' ? faSpinner
                                : backendStatus === 'online' ? faCheckCircle
                                    : faExclamationTriangle
                        }
                        style={{
                            ...(backendStatus === 'checking' ? { animation: 'spin 1s linear infinite' } : {}),
                        }}
                    />
                    <span>
                        {backendStatus === 'checking' && 'Connecting to backend...'}
                        {backendStatus === 'online' && 'Backend connected'}
                        {backendStatus === 'offline' && 'Backend not running — start with: cd server && python main.py'}
                    </span>
                </div>

                {/* Configuration Form */}
                <div className="setup-form">
                    {/* Project Path */}
                    <div className="setup-field">
                        <label>
                            <FontAwesomeIcon icon={faFolderOpen} style={{ marginRight: 8 }} />
                            Project Root
                        </label>
                        <div className="setup-input-row">
                            <input
                                type="text"
                                value={projectPath}
                                onChange={(e) => setProjectPath(e.target.value)}
                                placeholder="/path/to/your/react-project"
                                spellCheck={false}
                            />
                            <button
                                className="setup-btn-scan"
                                onClick={handleScan}
                                disabled={isScanning || !projectPath.trim() || backendStatus !== 'online'}
                            >
                                <FontAwesomeIcon icon={isScanning ? faSpinner : faSearch}
                                    style={isScanning ? { animation: 'spin 1s linear infinite' } : {}}
                                />
                                {isScanning ? 'Scanning...' : 'Scan'}
                            </button>
                        </div>
                    </div>

                    {/* Dev Server URL */}
                    <div className="setup-field">
                        <label>
                            <FontAwesomeIcon icon={faGlobe} style={{ marginRight: 8 }} />
                            Dev Server URL
                        </label>
                        <input
                            type="text"
                            value={devServerUrl}
                            onChange={(e) => setDevServerUrl(e.target.value)}
                            placeholder="http://localhost:3000"
                            spellCheck={false}
                        />
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="setup-error">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Scan Results */}
                {scanResult && !scanResult.error && (
                    <div className="setup-results">
                        <div className="setup-results-header">
                            <FontAwesomeIcon icon={faCubes} style={{ color: 'var(--accent-primary)' }} />
                            <span>Project Detected</span>
                        </div>

                        <div className="setup-results-grid">
                            <div className="setup-result-item">
                                <span className="setup-result-label">Framework</span>
                                <span className="setup-result-value">{scanResult.framework}</span>
                            </div>
                            <div className="setup-result-item">
                                <span className="setup-result-label">Components</span>
                                <span className="setup-result-value">{scanResult.totalFiles}</span>
                            </div>
                            <div className="setup-result-item">
                                <span className="setup-result-label">Dev Command</span>
                                <span className="setup-result-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                                    {scanResult.devCommand}
                                </span>
                            </div>
                        </div>

                        {/* Component List */}
                        {scanResult.components.length > 0 && (
                            <div className="setup-component-list">
                                {scanResult.components.slice(0, 8).map((comp) => (
                                    <div key={comp.filePath} className="setup-component-item">
                                        <FontAwesomeIcon icon={faCode} style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }} />
                                        <span className="setup-comp-name">{comp.name}</span>
                                        <span className="setup-comp-path">{comp.filePath}</span>
                                    </div>
                                ))}
                                {scanResult.components.length > 8 && (
                                    <div className="setup-component-item" style={{ color: 'var(--text-muted)' }}>
                                        +{scanResult.components.length - 8} more components
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="setup-actions">
                    <button
                        className="setup-btn-connect"
                        onClick={handleConnect}
                        disabled={isConfiguring || !projectPath.trim() || backendStatus !== 'online'}
                    >
                        <FontAwesomeIcon icon={isConfiguring ? faSpinner : faRocket}
                            style={isConfiguring ? { animation: 'spin 1s linear infinite' } : {}}
                        />
                        {isConfiguring ? 'Connecting...' : 'Connect & Start'}
                    </button>

                    {scanResult && !scanResult.error && (
                        <button className="setup-btn-quick" onClick={handleQuickStart}>
                            Quick Start with Current Project
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
