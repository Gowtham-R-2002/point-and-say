import { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
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
import { WebcamPreview } from './gesture/WebcamPreview';
import { useFingerTracking } from './gesture/useFingerTracking';
import { useVoice } from './voice/useVoice';
import { useComponentPicker } from './overlay/useComponentPicker';
import { captureScreenshot } from './utils/captureScreenshot';
import { groundComponent, generateCode, applyCode, undoLastChange, verifyChange } from './services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faBell, faHandPointer, faSpinner, faHand } from '@fortawesome/free-solid-svg-icons';
import { IconButton, Tooltip } from '@mui/material';
import type { PointerPosition, ReasoningStep, PipelineStatus } from './types';

interface AppProps {
  externalUrl: string | null;
}

function App({ externalUrl }: AppProps) {
  const [pointer, setPointer] = useState<PointerPosition | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle');
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

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

  // Finger tracking
  const {
    trackedPoint,
    isTracking,
    isLoading: isTrackingLoading,
    videoRef,
    toggleTracking,
  } = useFingerTracking();

  // Voice I/O
  const {
    voiceStatus,
    lastCommand: lastVoiceCommand,
    interimText,
    toggleListening,
    speak,
  } = useVoice();

  // Pointer: finger tracking takes priority
  const activePointer: PointerPosition | null = trackedPoint
    ? { x: trackedPoint.x, y: trackedPoint.y, source: 'finger', timestamp: trackedPoint.timestamp }
    : pointer;

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

  // ---- Finger Dwell-Selection ----
  // When finger hovers over a component for 1.5s, auto-open the picker
  const dwellTimerRef = useRef<number | null>(null);
  const lastDwellTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!trackedPoint || !isTracking) return;
    if (pipelineStatus !== 'idle' && pipelineStatus !== 'listening') return;
    if (pickerState.isOpen) return;

    // Find data-component element at finger position
    const el = document.elementFromPoint(trackedPoint.x, trackedPoint.y) as HTMLElement | null;
    let componentEl: HTMLElement | null = el;
    while (componentEl && !componentEl.getAttribute('data-component')) {
      componentEl = componentEl.parentElement;
    }

    const currentTarget = componentEl?.getAttribute('data-component') || null;

    // If target changed, reset the dwell timer
    if (currentTarget !== lastDwellTargetRef.current) {
      lastDwellTargetRef.current = currentTarget;
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }

      if (currentTarget && componentEl) {
        // Start dwell timer — open picker after 1.5s
        dwellTimerRef.current = window.setTimeout(() => {
          setPointer({ x: trackedPoint.x, y: trackedPoint.y, source: 'finger', timestamp: Date.now() });
          setReasoningSteps([]);
          document.querySelectorAll('[data-component-selected]').forEach(el => {
            (el as HTMLElement).removeAttribute('data-component-selected');
          });
          openPicker(trackedPoint.x, trackedPoint.y);
          dwellTimerRef.current = null;
        }, 1500);
      }
    }

    return () => {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
      }
    };
  }, [trackedPoint, isTracking, pipelineStatus, pickerState.isOpen, openPicker]);

  // ---- Reasoning Step Helpers ----
  const addStep = useCallback((step: Omit<ReasoningStep, 'id' | 'timestamp'>) => {
    const newStep: ReasoningStep = {
      ...step,
      id: crypto.randomUUID(),
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

      try {
        const { generation, originalCode } = await generateCode({
          componentName: selected.displayName,
          filePath: selected.filePath,
          intent,
          targetElement: selected.description, // e.g. "Call-to-action button — 'Get Started'"
        });

        updateStep(codegenId, {
          status: 'completed',
          message: generation.explanation,
        });

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

        // Voice confirmation step
        const confirmId = addStep({
          agent: 'confirm', agentLabel: 'Confirm', icon: '🔊',
          message: `"${generation.explanation}"`,
          status: 'in-progress',
        });

        await speak(`Done! ${generation.explanation}`);

        updateStep(confirmId, { status: 'completed' });
        setPipelineStatus('idle');
        setLastCommand(`✅ ${generation.explanation}`);

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed';
        updateStep(codegenId, { status: 'error', details: msg });
        setPipelineStatus('idle');
        setLastCommand(`Error: ${msg}`);
      }
    })();
  }, [lastVoiceCommand, pickerState.selected, pickerState.isOpen, addStep, updateStep, speak, selectByVoice]);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="app-main" onClick={externalUrl ? undefined : handleMainClick}>
        <div className="main-header" data-component="main-header">
          <div className="main-header-left">
            <h2>{externalUrl ? 'External Project' : 'Dashboard'}</h2>
            <p>
              {externalUrl
                ? <>Connected to <code style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>{externalUrl}</code>
                  {bridgeConnected && <span style={{ color: 'var(--accent-emerald)', marginLeft: 8, fontSize: '0.7rem' }}>● Bridge Active</span>}
                </>
                : "Welcome back, David. Here's what's happening today."
              }
            </p>
          </div>
          <div className="main-header-right">
            <Tooltip title="Search" arrow>
              <IconButton
                onClick={(e) => e.stopPropagation()}
                sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' } }}
              >
                <FontAwesomeIcon icon={faSearch} style={{ fontSize: '0.85rem' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Notifications" arrow>
              <IconButton
                onClick={(e) => e.stopPropagation()}
                sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--text-primary)' } }}
              >
                <FontAwesomeIcon icon={faBell} style={{ fontSize: '0.85rem' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={isTracking ? 'Stop finger tracking' : 'Start finger tracking'} arrow>
              <IconButton
                onClick={(e) => { e.stopPropagation(); toggleTracking(); }}
                sx={{
                  color: isTracking ? 'var(--accent-primary)' : 'var(--text-muted)',
                  background: isTracking ? 'var(--accent-primary-soft)' : 'transparent',
                  border: isTracking ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  '&:hover': { color: 'var(--accent-primary)', background: 'var(--accent-primary-soft)' },
                }}
              >
                <FontAwesomeIcon
                  icon={isTrackingLoading ? faSpinner : isTracking ? faHand : faHandPointer}
                  style={{ fontSize: '0.85rem', ...(isTrackingLoading ? { animation: 'spin 1s linear infinite' } : {}) }}
                />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        {externalUrl ? (
          <iframe
            ref={iframeRef}
            src={externalUrl}
            title="Target Application"
            style={{
              width: '100%',
              flex: 1,
              border: 'none',
              borderRadius: '12px',
              background: 'var(--bg-base)',
            }}
          />
        ) : (
          <>
            <HeroSection />
            <StatsCards />
            <AnalyticsChart />
            <DataTable />
            <ProfileCard />
            <ActionButton />
          </>
        )}
      </main>

      <ReasoningPanel
        steps={reasoningSteps}
        status={pipelineStatus}
        onClear={clearReasoning}
      />

      {activePointer && <PointerDot x={activePointer.x} y={activePointer.y} />}

      <ComponentPicker
        state={pickerState}
        onSelect={selectComponent}
        onHighlight={highlightComponent}
        onClose={closePicker}
      />

      <StatusBar
        status={pipelineStatus}
        lastCommand={lastCommand}
        voiceStatus={voiceStatus}
        interimText={interimText}
        onVoiceToggle={toggleListening}
      />
      <WebcamPreview videoRef={videoRef} isTracking={isTracking} />
    </div>
  );
}

export default App;