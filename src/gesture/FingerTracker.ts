/**
 * FingerTracker — MediaPipe Hands-based index finger tracking
 *
 * Tracks the user's index finger tip (landmark #8) via webcam,
 * maps to screen coordinates, and applies EMA smoothing to reduce jitter.
 */
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface TrackedPoint {
    x: number;
    y: number;
    confidence: number;
    timestamp: number;
}

export type TrackingCallback = (point: TrackedPoint | null) => void;

// Exponential moving average smoothing
interface EMA {
    x: number;
    y: number;
}

export class FingerTracker {
    private handLandmarker: HandLandmarker | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private stream: MediaStream | null = null;
    private animFrameId: number | null = null;
    private callback: TrackingCallback;
    private ema: EMA | null = null;
    private smoothingFactor = 0.35; // 0 = max smooth, 1 = no smooth
    private _isRunning = false;
    private lastFrameTime = -1;

    constructor(callback: TrackingCallback) {
        this.callback = callback;
    }

    get isRunning() {
        return this._isRunning;
    }

    /**
     * Initialize MediaPipe Hands and start webcam.
     * Returns the video element for preview display.
     */
    async start(): Promise<HTMLVideoElement> {
        // 1. Load MediaPipe vision WASM
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        // 2. Create hand landmarker
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath:
                    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        // 3. Open webcam
        this.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
            },
        });

        this.videoElement = document.createElement('video');
        this.videoElement.srcObject = this.stream;
        this.videoElement.autoplay = true;
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
        await this.videoElement.play();

        // 4. Start detection loop
        this._isRunning = true;
        this.detectLoop();

        return this.videoElement;
    }

    /**
     * Main detection loop — runs at animation frame rate.
     */
    private detectLoop = () => {
        if (!this._isRunning || !this.handLandmarker || !this.videoElement) return;

        const now = performance.now();

        // Only process if enough time has passed (~30fps cap to save CPU)
        if (now - this.lastFrameTime > 33) {
            this.lastFrameTime = now;

            const result = this.handLandmarker.detectForVideo(this.videoElement, now);

            if (result.landmarks && result.landmarks.length > 0) {
                const hand = result.landmarks[0];
                const indexTip = hand[8]; // Landmark #8 = index finger tip

                // Map webcam coordinates → screen coordinates
                // Webcam is mirrored, so x is inverted
                const rawX = (1 - indexTip.x) * window.innerWidth;
                const rawY = indexTip.y * window.innerHeight;

                // Apply EMA smoothing
                if (this.ema === null) {
                    this.ema = { x: rawX, y: rawY };
                } else {
                    this.ema.x = this.smoothingFactor * rawX + (1 - this.smoothingFactor) * this.ema.x;
                    this.ema.y = this.smoothingFactor * rawY + (1 - this.smoothingFactor) * this.ema.y;
                }

                this.callback({
                    x: this.ema.x,
                    y: this.ema.y,
                    confidence: indexTip.z !== undefined ? 1 - Math.abs(indexTip.z) : 0.8,
                    timestamp: Date.now(),
                });
            } else {
                // No hand detected
                this.callback(null);
            }
        }

        this.animFrameId = requestAnimationFrame(this.detectLoop);
    };

    /**
     * Stop tracking and release resources.
     */
    stop() {
        this._isRunning = false;

        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
        }

        if (this.handLandmarker) {
            this.handLandmarker.close();
            this.handLandmarker = null;
        }

        this.videoElement = null;
        this.ema = null;
    }

    /**
     * Adjust smoothing (0 = max smooth, 1 = raw/no smooth)
     */
    setSmoothingFactor(factor: number) {
        this.smoothingFactor = Math.max(0.05, Math.min(1, factor));
    }
}
