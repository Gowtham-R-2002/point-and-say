import { useState } from 'react';

const monthlyData = [
    { month: 'Jan', value: 65 },
    { month: 'Feb', value: 55 },
    { month: 'Mar', value: 70 },
    { month: 'Apr', value: 45 },
    { month: 'May', value: 60 },
    { month: 'Jun', value: 35 },
    { month: 'Jul', value: 50 },
    { month: 'Aug', value: 40 },
    { month: 'Sep', value: 55 },
    { month: 'Oct', value: 30 },
    { month: 'Nov', value: 45 },
    { month: 'Dec', value: 62 },
];

const maxValue = Math.max(...monthlyData.map(d => d.value));

export function AnalyticsChart() {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    return (
        <div className="chart-card glass-card" data-component="analytics-chart">
            {/* Header */}
            <div className="chart-header" data-component="chart-header">
                <div>
                    <div className="chart-title" data-component="chart-title">Revenue Breakdown</div>
                    <div className="chart-meta">
                        <span className="chart-value" data-component="chart-value">$70,240</span>
                        <span className="chart-badge-positive" data-component="chart-badge">↑ 12.5%</span>
                    </div>
                </div>
                <div className="chart-legend">
                    <span className="legend-dot" style={{ background: 'var(--accent-primary)' }} />
                    <span className="legend-label">Monthly Revenue</span>
                </div>
            </div>

            {/* Chart */}
            <div className="chart-area" data-component="chart-area">
                <div className="chart-bars">
                    {monthlyData.map((d, i) => {
                        const heightPct = (d.value / maxValue) * 100;
                        const isHovered = hoveredIndex === i;

                        return (
                            <div
                                key={d.month}
                                className={`chart-bar-col ${isHovered ? 'hovered' : ''}`}
                                onMouseEnter={() => setHoveredIndex(i)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                {/* Tooltip */}
                                {isHovered && (
                                    <div className="bar-tooltip">
                                        ${(d.value * 100).toLocaleString()}
                                    </div>
                                )}
                                {/* Bar */}
                                <div className="chart-bar-track">
                                    <div
                                        className="chart-bar-fill"
                                        style={{
                                            height: `${heightPct}%`,
                                            opacity: hoveredIndex === null || isHovered ? 1 : 0.35,
                                        }}
                                    />
                                </div>
                                {/* Label */}
                                <span className="chart-bar-label">{d.month}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="chart-footer" data-component="chart-footer">
                <span>Avg: $4,370/mo</span>
                <span>Peak: Mar ($7,000)</span>
            </div>
        </div>
    );
}