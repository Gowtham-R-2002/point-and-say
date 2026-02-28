// ========================================
// Shared Types for Point & Say UI
// ========================================

/** Maps component names to their source files and metadata */
export interface ComponentInfo {
  name: string;
  displayName: string;
  filePath: string;
  dataAttribute: string;
  editableProperties: EditableProperty[];
}

export interface EditableProperty {
  property: string;
  type: 'color' | 'text' | 'size' | 'class' | 'boolean';
  currentValue: string;
  cssVariable?: string;
}

/** Pointer position from gesture tracking or mouse */
export interface PointerPosition {
  x: number;
  y: number;
  source: 'mouse' | 'finger';
  timestamp: number;
}

/** Result from visual grounding (Nova 2 Lite) */
export interface GroundingResult {
  componentName: string;
  elementType: string;
  currentProperties: Record<string, string>;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

/** Structured code change (not raw code, for reliability) */
export interface CodeChange {
  action: 'modify_style' | 'change_text' | 'delete_component' | 'undo';
  targetComponent: string;
  changes: PropertyChange[];
  explanation: string;
}

export interface PropertyChange {
  property: string;
  value: string;
}

/** Agent reasoning step (for the reasoning panel) */
export interface ReasoningStep {
  id: string;
  agent: 'voice' | 'vision' | 'grounding' | 'codegen' | 'apply' | 'verify' | 'confirm';
  agentLabel: string;
  icon: string;
  message: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  timestamp: number;
  details?: string;
}

/** Pipeline state */
export type PipelineStatus = 'idle' | 'listening' | 'capturing' | 'grounding' | 'processing' | 'generating' | 'applying' | 'verifying' | 'confirming' | 'error';

/** Full app state */
export interface AppState {
  pointer: PointerPosition | null;
  pipelineStatus: PipelineStatus;
  reasoningSteps: ReasoningStep[];
  lastCommand: string | null;
  undoStack: UndoEntry[];
}

export interface UndoEntry {
  filePath: string;
  previousContent: string;
  change: CodeChange;
  timestamp: number;
}
