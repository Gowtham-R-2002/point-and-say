import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDollarSign,
    faUserFriends, // Changed from faUserGroup to faUserFriends
    faCheckDouble,
    faListCheck,
    faArrowUp,
    faArrowDown,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface StatItem {
    icon: IconDefinition;
    iconColor: string;
    iconBg: string;
    label: string;
    value: string;
    change: string;
    positive: boolean;
    dataAttr: string;
}

const stats: StatItem[] = [
    {
        icon: faDollarSign,
        iconColor: 'var(--accent-primary)',
        iconBg: 'rgba(251, 140, 102, 0.15)',
        label: 'TOTAL REVENUE',
        value: '$50,000',
        change: '+12.5%',
        positive: true,
        dataAttr:'stats-card-1',
    },
    {
        icon: faUserFriends, // Changed from faUserGroup to faUserFriends
        iconColor: 'var(--accent-primary)', // Changed from --accent-purple to --accent-primary
        iconBg: 'rgba(251, 140, 102, 0.15)', // Changed from --accent-purple to --accent-primary
        label: 'ACTIVE USERS',
        value: '2,847',
        change: '+8.2%',
        positive: true,
        dataAttr:'stats-card-2',
    },
    {
        icon: faCheckDouble,
        iconColor: 'var(--accent-emerald)',
        iconBg: 'rgba(52, 211, 153, 0.15)',
        label: 'COMPLETION RATE',
        value: '94.2%',
        change: '-1.4%',
        positive: false,
        dataAttr:'stats-card-3',
    },
    {
        icon: faListCheck,
        iconColor: '#f87171',
        iconBg: 'rgba(248, 113, 113, 0.15)',
        label: 'TASKS DONE',
        value: '1,284',
        change: '+24.8%',
        positive: true,
        dataAttr:'stats-card-4',
    },
];

export function StatsCards() {
    const selectedCard ='stats-card-3';

    return (
        <div className="stats-strip" data-component="stats-cards">
            {stats.map((stat, i) => (
                <div
                    key={stat.dataAttr}
                    className={`stat-card glass-card stagger-${i + 1} ${stat.dataAttr === selectedCard ?'selected' : ''}`}
                    data-component={stat.dataAttr}
                    style={{ animationDelay: `${i * 60}ms`, width: '250px' }}
                >
                    <div className="stat-icon-badge" style={{ background: stat.iconBg }}>
                        <FontAwesomeIcon icon={stat.icon} style={{ color: stat.iconColor, fontSize: '0.85rem' }} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label" data-component="stat-label">{stat.label}</span>
                        <span className="stat-value" data-component="stat-value">{stat.value}</span>
                        <span className={`stat-change ${stat.positive? 'positive' : 'negative'}`} data-component="stat-change">
                            <FontAwesomeIcon
                                icon={stat.positive? faArrowUp : faArrowDown}
                                style={{ fontSize: '0.55rem', marginRight: 3 }}
                            />
                            {stat.change}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
