import { useEffect, useRef, type RefObject } from 'react';

interface WebcamPreviewProps {
    videoRef: RefObject<HTMLVideoElement | null>;
    isTracking: boolean;
}

/**
 * Corner webcam preview widget.
 * Displays the mirrored webcam feed and tracking status.
 */
export function WebcamPreview({ videoRef, isTracking }: WebcamPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        const video = videoRef.current;
        if (!container || !video || !isTracking) return;

        // Attach the video element to the preview container
        video.style.width = '100%';
        video.style.display = 'block';
        video.style.transform = 'scaleX(-1)';
        video.style.borderRadius = 'inherit';

        container.appendChild(video);

        return () => {
            if (container.contains(video)) {
                container.removeChild(video);
            }
        };
    }, [videoRef, isTracking]);

    if (!isTracking) return null;

    return (
        <div className="webcam-preview" ref={containerRef}>
            <div
                style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(8px)',
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    color: 'var(--accent-emerald)',
                    zIndex: 10,
                }}
            >
                <span
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--accent-emerald)',
                        animation: 'pulse-soft 1.5s ease infinite',
                    }}
                />
                TRACKING
            </div>
        </div>
    );
}
