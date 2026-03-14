/**
 * captureScreenshot — Capture the dashboard area and overlay a pointer dot
 *
 * Uses html2canvas to render the main content to a canvas,
 * then draws a red pointer dot at the specified coordinates.
 * Returns a base64 PNG string ready for Nova 2 Lite.
 */
import html2canvas from 'html2canvas';

export interface CaptureOptions {
    /** The element to capture (defaults to .app-main) */
    target?: HTMLElement;
    /** Pointer position in viewport coordinates */
    pointerX: number;
    pointerY: number;
    /** Dot radius in pixels */
    dotRadius?: number;
    /** Scale factor for output resolution */
    scale?: number;
}

export interface CaptureResult {
    /** Base64-encoded PNG image data (no prefix) */
    imageBase64: string;
    /** Width of the captured image */
    width: number;
    /** Height of the captured image */
    height: number;
    /** Pointer position relative to the captured element */
    relativePointerX: number;
    relativePointerY: number;
}

/**
 * Capture a screenshot of the target element with a red pointer dot overlay.
 */
export async function captureScreenshot(options: CaptureOptions): Promise<CaptureResult> {
    const target = options.target
        ?? document.querySelector('.preview-content') as HTMLElement
        ?? document.querySelector('.app-main') as HTMLElement;

    if (!target) {
        throw new Error('Capture target element not found');
    }

    const rect = target.getBoundingClientRect();
    const scale = options.scale ?? 1;
    const dotRadius = options.dotRadius ?? 12;

    // Capture the element to canvas
    const canvas = await html2canvas(target, {
        scale,
        backgroundColor: '#0c0c14',
        logging: false,
        useCORS: true,
        allowTaint: true,
    });

    // Calculate pointer position relative to the element
    const relX = (options.pointerX - rect.left) * scale;
    const relY = (options.pointerY - rect.top) * scale;

    // Draw the red pointer dot
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Outer glow
        const gradient = ctx.createRadialGradient(relX, relY, 0, relX, relY, dotRadius * 2.5 * scale);
        gradient.addColorStop(0, 'rgba(255, 60, 60, 0.6)');
        gradient.addColorStop(0.5, 'rgba(255, 60, 60, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 60, 60, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(relX, relY, dotRadius * 2.5 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Inner dot
        ctx.fillStyle = '#ff3c3c';
        ctx.beginPath();
        ctx.arc(relX, relY, dotRadius * scale, 0, Math.PI * 2);
        ctx.fill();

        // White center
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(relX, relY, (dotRadius * 0.3) * scale, 0, Math.PI * 2);
        ctx.fill();
    }

    // Export as base64
    const dataUrl = canvas.toDataURL('image/png');
    const imageBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');

    return {
        imageBase64,
        width: canvas.width,
        height: canvas.height,
        relativePointerX: relX / scale,
        relativePointerY: relY / scale,
    };
}
