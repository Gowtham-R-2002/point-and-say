import React from'react';

export function AnalyticsChart() {
    const data = [
        { category: 'Jan', value: 65, color: 'var(--accent-primary)' },
        { category: 'Feb', value: 55, color: 'var(--accent-secondary)' },
        { category: 'Mar', value: 70, color: 'var(--accent-emerald)' },
        { category: 'Apr', value: 45, color: 'var(--accent-blue)' },
        { category: 'May', value: 60, color: 'var(--accent-rose)' },
        { category: 'Jun', value: 35, color: 'var(--accent-amber)' },
        { category: 'Jul', value: 25, color: '#8b5cf6' },
        { category: 'Aug', value: 40, color: '#06b6d4' },
        { category: 'Sep', value: 20, color: '#f43f5e' },
        { category: 'Oct', value: 30, color: '#84cc16' },
        { category: 'Nov', value: 15, color: '#e879f9' },
        { category: 'Dec', value: 10, color: '#fb923c' },
    ];

    const width = 500;
    const height = 300; // Increased height to make the chart less congested

    return (
        <div className="chart-card glass-card" data-component="analytics-chart">
            <div className="chart-header" data-component="chart-header">
                <div>
                    <div className="chart-title" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Revenue Breakdown</div>
                    <div className="chart-subtitle" style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Total Revenue</div>
                    <div className="chart-value" data-component="chart-value" style={{ fontSize: '1.25rem', fontWeight: '600' }}>$70,240</div>
                </div>
                <div className="chart-badge" data-component="chart-badge">
                    <span className="chart-badge-positive" style={{ fontSize: '0.875rem', fontWeight: '500' }}>+12.5%</span>
                </div>
            </div>
            <div className="chart-area" data-component="chart-area">
                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
                    {data.map((d, i) => (
                        <g key={i}>
                            <rect
                                x={i * 40 + 20} // Adjusted for bar width and spacing
                                y={height - d.value * 2} // Adjusted to draw from bottom
                                width={30} // Width of each bar
                                height={d.value * 2} // Height of each bar
                                fill={d.color}
                                style={{ transition: 'opacity 0.3s ease', cursor: 'pointer' }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
                            />
                            <text
                                x={i * 40 + 35} // Adjusted to center text
                                y={height - 5} // Positioned just above the bar
                                textAnchor="middle"
                                fill="var(--text-primary)"
                                fontSize="12"
                                fontFamily="var(--font-sans)"
                            >
                                {d.category}
                            </text>
                            <text
                                x={i * 40 + 35} // Adjusted to center text
                                y={height - d.value * 2 - 5} // Positioned just above the bar
                                textAnchor="middle"
                                fill="var(--text-primary)"
                                fontSize="12"
                                fontFamily="var(--font-sans)"
                            >
                                {d.value}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>
            <div className="chart-footer" data-component="chart-footer">
                <p>Active Users: 5000</p>
            </div>
        </div>
    );
}