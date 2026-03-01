interface PointerDotProps {
    x: number;
    y: number;
}

export function PointerDot({ x, y }: PointerDotProps) {
    return (
        <div
            className="pointer-dot"
            style={{ left: `${x}px`, top: `${y}px` }}
        />
    );
}
