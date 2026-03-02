/**
 * API Client — Frontend service for communicating with the Python backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ========== Types ==========

export interface GroundingRequest {
    imageBase64: string;
    pointerX: number;
    pointerY: number;
    imageWidth: number;
    imageHeight: number;
}

export interface GroundingResponse {
    componentName: string;
    dataAttribute: string;
    elementType: string;
    currentProperties: Record<string, string>;
    confidence: number;
    filePath?: string;
    mock?: boolean;
    fallback?: boolean;
    error?: string;
}

export interface GenerateRequest {
    componentName: string;
    filePath: string;
    intent: string;
    targetElement?: string; // e.g. "Call-to-action button — 'Get Started'" for precision
}

export interface GenerateResponse {
    modifiedCode: string;
    explanation: string;
    mock?: boolean;
    fallback?: boolean;
    error?: string;
}

export interface ApplyRequest {
    filePath: string;
    modifiedCode: string;
    originalCode?: string;
    explanation?: string;
}

// ========== Grounding ==========

export async function groundComponent(req: GroundingRequest): Promise<GroundingResponse> {
    const res = await fetch(`${API_BASE}/api/ground`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    });

    if (!res.ok) throw new Error(`Grounding API error: ${res.status}`);

    const data = await res.json();
    return data.grounding;
}

// ========== Code Generation ==========

export async function generateCode(req: GenerateRequest): Promise<{ generation: GenerateResponse; originalCode: string }> {
    const res = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    });

    if (!res.ok) throw new Error(`Generate API error: ${res.status}`);

    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message);

    return { generation: data.generation, originalCode: data.originalCode };
}

// ========== Code Application ==========

export async function applyCode(req: ApplyRequest): Promise<{ message: string; undoAvailable: boolean; unchanged?: boolean }> {
    const res = await fetch(`${API_BASE}/api/apply-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    });

    if (!res.ok) throw new Error(`Apply API error: ${res.status}`);

    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message);

    return { message: data.message, undoAvailable: data.undoAvailable, unchanged: data.unchanged || false };
}

// ========== Undo ==========

export async function undoLastChange(): Promise<{ message: string; explanation: string; undoAvailable: boolean }> {
    const res = await fetch(`${API_BASE}/api/undo`, {
        method: 'POST',
    });

    if (!res.ok) throw new Error(`Undo API error: ${res.status}`);

    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message);

    return { message: data.message, explanation: data.explanation, undoAvailable: data.undoAvailable };
}

// ========== Component Source ==========

export async function getComponentSource(componentName: string): Promise<{ filePath: string; source: string }> {
    const res = await fetch(`${API_BASE}/api/component-source/${encodeURIComponent(componentName)}`);

    if (!res.ok) throw new Error(`Component source API error: ${res.status}`);

    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || 'Failed to get component source');

    return { filePath: data.filePath, source: data.source };
}

// ========== Verification (Nova Act / Nova Lite Vision) ==========

export async function verifyChange(
    expectedChange: string,
    componentName: string,
    screenshotBase64?: string,
    targetElement?: string,
): Promise<{ verified: boolean; reason: string; method: string; mock: boolean }> {
    const res = await fetch(`${API_BASE}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedChange, componentName, screenshotBase64, targetElement }),
    });

    if (!res.ok) throw new Error(`Verify API error: ${res.status}`);

    const data = await res.json();
    return data.verification;
}

// ========== Health ==========

export async function checkHealth(): Promise<{ ok: boolean; awsConfigured: boolean }> {
    try {
        const res = await fetch(`${API_BASE}/health`);
        if (!res.ok) return { ok: false, awsConfigured: false };
        const data = await res.json();
        return { ok: data.status === 'ok', awsConfigured: data.aws_configured ?? false };
    } catch {
        return { ok: false, awsConfigured: false };
    }
}
