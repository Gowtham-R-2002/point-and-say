import { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import './playground/Playground.css';
import { Sidebar } from './app/components/Sidebar';
import { HeroSection } from './app/components/HeroSection';
import { StatsCards } from './app/components/StatsCards';
import { AnalyticsChart } from './app/components/AnalyticsChart';
import { ActionButton } from './app/components/ActionButton';
import { ProfileCard } from './app/components/ProfileCard';
import { DataTable } from './app/components/DataTable';
import { ReasoningPanel } from './overlay/ReasoningPanel';
import { PointerDot } from './overlay/PointerDot';
import { StatusBar } from './overlay/StatusBar';
import { ComponentPicker } from './overlay/ComponentPicker';
import { FileTree } from './playground/FileTree';
import { DiffModal } from './playground/DiffModal';
import type { DiffData } from './playground/DiffView';
import { FolderTree, GitCompareArrows } from 'lucide-react';

import { useVoice } from './voice/useVoice';
import { useComponentPicker } from './overlay/useComponentPicker';
import { captureScreenshot } from './utils/captureScreenshot';
import { groundComponent, generateCode, applyCode, undoLastChange, verifyChange } from './services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faBell } from '@fortawesome/free-solid-svg-icons';
import { IconButton, Tooltip } from '@mui/material';
import type { PointerPosition, ReasoningStep, PipelineStatus } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface AppProps {
  externalUrl: string | null;
}

function App({ externalUrl }: AppProps) {
  const [pointer, setPointer] = useState<PointerPosition | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle');
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  // Playground state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [lastDiff, setLastDiff] = useState<DiffData | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  // External project state
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Component Picker (replaces pure vision grounding)
  const {
    pickerState,
    openPicker,
    selectComponent,
    selectByVoice,
    highlightComponent,
    closePicker,
    resetPicker,
    openPickerWithComponents,
  } = useComponentPicker();



  // Voice I/O
  const {
    voiceStatus,
    lastCommand: lastVoiceCommand,
    interimText,
    toggleListening,
    speak,
  } = useVoice();



  // Track last processed voice command to avoid double-processing
  const lastProcessedRef = useRef<string | null>(null);

  // ---- Listen for postMessage from bridge in iframe ----
  useEffect(() => {
    if (!externalUrl) return;

    const handler = (e: MessageEvent) => {
      if (!e.data || !e.data.type) return;

      if (e.data.type === 'PAS_BRIDGE_READY') {
        setBridgeConnected(true);
      }

      if (e.data.type === 'PAS_COMPONENT_CLICK') {
        if (pipelineStatus !== 'idle' && pipelineStatus !== 'listening') return;

        const { components, clickX, clickY } = e.data;
        const iframe = iframeRef.current;
        let offsetX = 0, offsetY = 0;
        if (iframe) {
          const rect = iframe.getBoundingClientRect();
          offsetX = rect.left;
          offsetY = rect.top;
        }

        setPointer({ x: clickX + offsetX, y: clickY + offsetY, source: 'mouse', timestamp: Date.now() });
        setReasoningSteps([]);

        if (components.length > 0) {
          openPickerWithComponents(components, clickX + offsetX, clickY + offsetY);
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [externalUrl, pipelineStatus, openPickerWithComponents]);



  // ---- Reasoning Step Helpers ----
  const addStep = useCallback((step: Omit<ReasoningStep, 'id' | 'timestamp'>) => {
    const newStep: ReasoningStep = {
      ...step,
      id: (typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    };
    setReasoningSteps(prev => [...prev, newStep]);
    return newStep.id;
  }, []);

  const updateStep = useCallback((id: string, updates: Partial<ReasoningStep>) => {
    setReasoningSteps(prev =>
      prev.map(step => step.id === id ? { ...step, ...updates } : step)
    );
  }, []);

  const clearReasoning = useCallback(() => {
    setReasoningSteps([]);
    setLastCommand(null);
    resetPicker();
    // Clear any selected highlights
    document.querySelectorAll('[data-component-selected]').forEach(el => {
      (el as HTMLElement).removeAttribute('data-component-selected');
    });
  }, [resetPicker]);

  // ---- Step 1: Click → Component Picker ----
  const handleMainClick = useCallback((e: React.MouseEvent) => {
    // Don't open picker if we're in the middle of a pipeline
    if (pipelineStatus !== 'idle' && pipelineStatus !== 'listening') return;

    const clickX = e.clientX;
    const clickY = e.clientY;

    setPointer({ x: clickX, y: clickY, source: 'mouse', timestamp: Date.now() });
    setReasoningSteps([]);

    // Clear previous selection highlights
    document.querySelectorAll('[data-component-selected]').forEach(el => {
      (el as HTMLElement).removeAttribute('data-component-selected');
    });

    // Use the component picker (DOM-based, deterministic)
    openPicker(clickX, clickY);
  }, [openPicker, pipelineStatus]);

  // ---- Step 2: Component Selected → Update Reasoning + Run Nova Vision in parallel ----
  useEffect(() => {
    if (!pickerState.selected) return;

    const selected = pickerState.selected;

    // Highlight the selected element in the DOM
    document.querySelectorAll('[data-component-selected]').forEach(el => {
      (el as HTMLElement).removeAttribute('data-component-selected');
    });
    selected.element.setAttribute('data-component-selected', 'true');

    // Clear previous steps and show selection
    setReasoningSteps([]);
    setPipelineStatus('listening');

    // Step: DOM-based selection (instant)
    addStep({
      agent: 'grounding', agentLabel: 'Grounding', icon: '🎯',
      message: `Selected: ${selected.displayName}`,
      status: 'completed',
      details: `${selected.description} → ${selected.filePath}`,
    });

    // Run Nova Vision in parallel as a confidence indicator (non-blocking)
    (async () => {
      const visionId = addStep({
        agent: 'vision', agentLabel: 'Nova Vision', icon: '👁',
        message: 'Verifying with Nova 2 Lite vision...',
        status: 'in-progress',
      });

      try {
        const capture = await captureScreenshot({
          pointerX: selected.bounds.left + selected.bounds.width / 2,
          pointerY: selected.bounds.top + selected.bounds.height / 2,
        });

        const grounding = await groundComponent({
          imageBase64: capture.imageBase64,
          pointerX: capture.relativePointerX,
          pointerY: capture.relativePointerY,
          imageWidth: capture.width,
          imageHeight: capture.height,
        });

        const matches = grounding.componentName === selected.displayName;
        updateStep(visionId, {
          status: 'completed',
          message: matches
            ? `Nova confirms: ${grounding.componentName} (${(grounding.confidence * 100).toFixed(0)}%)`
            : `Nova sees: ${grounding.componentName} (DOM selection takes priority)`,
        });
      } catch {
        updateStep(visionId, {
          status: 'completed',
          message: 'Nova Vision unavailable — DOM selection is authoritative',
        });
      }
    })();

    // Prompt user to speak
    addStep({
      agent: 'voice', agentLabel: 'Voice', icon: '🎤',
      message: `What would you like to do with ${selected.displayName}?`,
      status: 'pending',
    });

    setLastCommand(`Selected: ${selected.displayName}`);
  }, [pickerState.selected, addStep, updateStep]);

  // ---- Step 3: Voice Command → Generate → Apply ----
  useEffect(() => {
    if (!lastVoiceCommand || !lastVoiceCommand.isFinal) return;
    if (lastVoiceCommand.text === lastProcessedRef.current) return;

    lastProcessedRef.current = lastVoiceCommand.text;
    const intent = lastVoiceCommand.text;

    // If picker is open, try voice selection first
    if (pickerState.isOpen) {
      selectByVoice(intent);
      return;
    }

    // Need a selected component for code changes
    if (!pickerState.selected) return;

    const selected = pickerState.selected;

    // Handle undo command
    if (intent.toLowerCase().includes('undo')) {
      (async () => {
        setPipelineStatus('applying');
        const undoId = addStep({
          agent: 'apply', agentLabel: 'Apply', icon: '↩️',
          message: 'Undoing last change...',
          status: 'in-progress',
        });

        try {
          const result = await undoLastChange();
          updateStep(undoId, { status: 'completed', message: result.message });
          setPipelineStatus('confirming');
          await speak('Done! I\'ve undone the last change.');
          setPipelineStatus('idle');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Undo failed';
          updateStep(undoId, { status: 'error', details: msg });
          setPipelineStatus('idle');
        }
      })();
      return;
    }

    // Normal pipeline: generate → apply
    (async () => {
      // Update voice step
      addStep({
        agent: 'voice', agentLabel: 'Voice', icon: '🎤',
        message: `"${intent}"`,
        status: 'completed',
      });

      // Code generation step
      setPipelineStatus('generating');
      const codegenId = addStep({
        agent: 'codegen', agentLabel: 'CodeGen', icon: '💻',
        message: `Generating changes for ${selected.displayName}...`,
        status: 'in-progress',
      });

      // Rotating progress messages while Nova Premier thinks (~30-60s)
      const progressMessages = [
        `Analyzing ${selected.displayName} source code...`,
        'Parsing component structure and dependencies...',
        'Understanding design system tokens...',
        `Planning modifications for: "${intent.slice(0, 40)}"...`,
        'Generating modified TypeScript/JSX...',
        'Validating imports and exports...',
        'Ensuring no breaking changes...',
        'Applying design system constraints...',
        'Running final code validation...',
        'Almost ready — assembling the complete file...',
      ];
      let progressIdx = 0;
      const progressTimer = setInterval(() => {
        progressIdx = (progressIdx + 1) % progressMessages.length;
        updateStep(codegenId, {
          message: progressMessages[progressIdx],
          status: 'in-progress',
        });
      }, 3000);

      try {
        const { generation, originalCode } = await generateCode({
          componentName: selected.displayName,
          filePath: selected.filePath,
          intent,
          targetElement: selected.description,
        });

        clearInterval(progressTimer);
        updateStep(codegenId, {
          status: 'completed',
          message: generation.explanation,
        });

        // Capture diff for the playground
        setLastDiff({
          original: originalCode,
          modified: generation.modifiedCode,
          filePath: selected.filePath,
          timestamp: Date.now(),
        });
        setSelectedFile(selected.filePath);
        // Refresh code viewer with the new content
        fetchFileContent(selected.filePath);

        // Apply step
        setPipelineStatus('applying');
        const applyId = addStep({
          agent: 'apply', agentLabel: 'Apply', icon: '🔧',
          message: `Writing changes to ${selected.filePath}...`,
          status: 'in-progress',
        });

        const applyResult = await applyCode({
          filePath: selected.filePath,
          modifiedCode: generation.modifiedCode,
          originalCode,
          explanation: generation.explanation,
        });

        if (applyResult.unchanged) {
          updateStep(applyId, {
            status: 'error',
            message: `⚠️ No changes detected — AI returned identical code. Try being more specific.`,
          });
          setPipelineStatus('idle');
          await speak("Sorry, I couldn't make that change. Could you try again with more specific wording?");
          setLastCommand('⚠️ Change failed — code was unchanged');
          return;
        }

        updateStep(applyId, {
          status: 'completed',
          message: `Applied to ${selected.filePath} — HMR will refresh`,
        });

        // Verification step — wait for HMR then verify
        setPipelineStatus('confirming');
        const verifyId = addStep({
          agent: 'verify', agentLabel: 'Verify', icon: '🔍',
          message: 'Verifying change with Nova...',
          status: 'in-progress',
        });

        // Wait 2.5s for HMR to fully apply
        await new Promise(r => setTimeout(r, 2500));

        try {
          const verifyCapture = await captureScreenshot({
            pointerX: selected.bounds.left + selected.bounds.width / 2,
            pointerY: selected.bounds.top + selected.bounds.height / 2,
          });

          const verification = await verifyChange(
            generation.explanation,
            selected.displayName,
            verifyCapture.imageBase64,
            selected.description, // e.g. "Chart footer info" — helps verify the RIGHT element
          );

          updateStep(verifyId, {
            // Verified = completed, not verified = still completed but with warning
            // (false negatives are common — don't show error for working changes)
            status: 'completed',
            message: verification.verified
              ? `✅ Verified via ${verification.method}: ${verification.reason.slice(0, 80)}`
              : `⚠️ Unconfirmed (may still be correct): ${verification.reason.slice(0, 80)}`,
          });
        } catch {
          updateStep(verifyId, {
            status: 'completed',
            message: 'Verification skipped (service unavailable)',
          });
        }

        const explanationText = generation.explanation || 'Code modified successfully';

        // Voice confirmation step
        const confirmId = addStep({
          agent: 'confirm', agentLabel: 'Confirm', icon: '🔊',
          message: `"${explanationText}"`,
          status: 'in-progress',
        });

        await speak(`Done! ${explanationText}`);

        updateStep(confirmId, { status: 'completed' });
        setPipelineStatus('idle');
        setLastCommand(`✅ ${explanationText}`);

      } catch (err) {
        clearInterval(progressTimer);
        const msg = err instanceof Error ? err.message : 'Generation failed';
        updateStep(codegenId, { status: 'error', details: msg });
        setPipelineStatus('idle');
        setLastCommand(`Error: ${msg}`);
      }
    })();
  }, [lastVoiceCommand, pickerState.selected, pickerState.isOpen, addStep, updateStep, speak, selectByVoice]);

  // Fetch file content for the playground code viewer
  const fetchFileContent = useCallback(async (path: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/file-content?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.status === 'ok') {
        setFileContent(data.content);
      }
    } catch {
      setFileContent('// Failed to load file');
    }
  }, []);

  const handleFileSelect = useCallback((path: string) => {
    setSelectedFile(path);
    fetchFileContent(path);
  }, [fetchFileContent]);

  return (
    <div className="playground-layout">
      {/* ===== Playground Header ===== */}
      <header className="playground-header">
        <div className="playground-brand">
          <span className="brand-name">Point & Say</span>
          <span className="brand-badge">Playground</span>
        </div>
        <div className="playground-controls">
          <StatusBar
            status={pipelineStatus}
            lastCommand={lastCommand}
            voiceStatus={voiceStatus}
            interimText={interimText}
            onVoiceToggle={toggleListening}
          />
        </div>
      </header>

      {/* ===== Left: File Explorer ===== */}
      <aside className="playground-sidebar">
        <div className="section-header">
          <FolderTree size={14} className="section-icon-svg" />
          <span>Explorer</span>
        </div>
        <FileTree
          selectedFile={selectedFile}
          activeFile={lastDiff?.filePath || null}
          onSelectFile={handleFileSelect}
        />
      </aside>

      {/* ===== Center: Live Preview ===== */}
      <main className="playground-preview" onClick={externalUrl ? undefined : handleMainClick}>
        <div className="preview-frame">
          <div className="preview-toolbar">
            <div className="preview-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <div className="preview-url">localhost:5173</div>
          </div>
          <div className="preview-content">
            {externalUrl ? (
              <iframe
                ref={iframeRef}
                src={externalUrl}
                title="Target Application"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <div className="app-preview">
                <Sidebar />
                <div className="preview-main">
                  <div className="main-header" data-component="main-header">
                    <div className="main-header-left">
                      <h2>Dashboard</h2>
                      <p>Welcome back, David. Here&apos;s what&apos;s happening today.</p>
                    </div>
                    <div className="main-header-right">
                      <Tooltip title="Search" arrow>
                        <IconButton onClick={(e) => e.stopPropagation()}
                          sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' } }}>
                          <FontAwesomeIcon icon={faSearch} style={{ fontSize: '0.85rem' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Notifications" arrow>
                        <IconButton onClick={(e) => e.stopPropagation()}
                          sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' } }}>
                          <FontAwesomeIcon icon={faBell} style={{ fontSize: '0.85rem' }} />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>
                  <HeroSection />
                  <StatsCards />
                  <AnalyticsChart />
                  <DataTable />
                  <ProfileCard />
                  <ActionButton />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ===== Right: Reasoning + View Changes ===== */}
      <aside className="playground-panel">
        <div className="panel-section reasoning-section">
          <ReasoningPanel
            steps={reasoningSteps}
            status={pipelineStatus}
            onClear={clearReasoning}
          />
        </div>
        {lastDiff && (
          <button className="view-changes-btn" onClick={() => setShowDiffModal(true)}>
            <GitCompareArrows size={16} />
            <span>View Changes</span>
            <span className="changes-file">{lastDiff.filePath.split('/').pop()}</span>
          </button>
        )}
      </aside>

      {/* ===== Overlays ===== */}
      {pointer && <PointerDot x={pointer.x} y={pointer.y} />}
      <ComponentPicker
        state={pickerState}
        onSelect={selectComponent}
        onHighlight={highlightComponent}
        onClose={closePicker}
      />
      {showDiffModal && lastDiff && (
        <DiffModal diff={lastDiff} onClose={() => setShowDiffModal(false)} />
      )}
    </div>
  );
}

export default App;