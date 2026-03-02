/**
 * useFingerTracking — React hook wrapping FingerTracker
 *
 * Manages lifecycle (start/stop), provides tracked position,
 * and exposes a ref for the webcam video element.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { FingerTracker } from './FingerTracker';
import type { TrackedPoint } from './FingerTracker';

export function useFingerTracking() {
    const [trackedPoint, setTrackedPoint] = useState<TrackedPoint | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const trackerRef = useRef<FingerTracker | null>(null);

    const startTracking = useCallback(async () => {
        if (trackerRef.current?.isRunning) return;

        setIsLoading(true);
        setError(null);

        try {
            const tracker = new FingerTracker((point) => {
                setTrackedPoint(point);
            });

            const video = await tracker.start();
            videoRef.current = video;
            trackerRef.current = tracker;
            setIsTracking(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to start tracking';
            setError(message);
            console.error('FingerTracker start failed:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const stopTracking = useCallback(() => {
        trackerRef.current?.stop();
        trackerRef.current = null;
        videoRef.current = null;
        setIsTracking(false);
        setTrackedPoint(null);
    }, []);

    const toggleTracking = useCallback(() => {
        if (isTracking) {
            stopTracking();
        } else {
            startTracking();
        }
    }, [isTracking, startTracking, stopTracking]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            trackerRef.current?.stop();
        };
    }, []);

    return {
        trackedPoint,
        isTracking,
        isLoading,
        error,
        videoRef,
        startTracking,
        stopTracking,
        toggleTracking,
    };
}
