// ========================================
// Component Registry
// Maps component names to source files & editable properties
// ========================================

import type { ComponentInfo } from '../types';

export const COMPONENT_REGISTRY: Record<string, ComponentInfo> = {
    'hero-section': {
        name: 'hero-section',
        displayName: 'Hero Section',
        filePath: 'src/app/components/HeroSection.tsx',
        dataAttribute: 'hero-section',
        editableProperties: [
            { property: 'title', type: 'text', currentValue: 'Welcome to Nova Dashboard' },
            { property: 'subtitle', type: 'text', currentValue: 'Your AI-powered analytics at a glance' },
            { property: 'backgroundColor', type: 'color', currentValue: 'transparent' },
        ],
    },
    'stats-card-1': {
        name: 'stats-card-1',
        displayName: 'Stats Card — Revenue',
        filePath: 'src/app/components/StatsCards.tsx',
        dataAttribute: 'stats-card-1',
        editableProperties: [
            { property: 'value', type: 'text', currentValue: '$48,352' },
            { property: 'label', type: 'text', currentValue: 'Total Revenue' },
            { property: 'backgroundColor', type: 'color', currentValue: 'var(--bg-card)' },
        ],
    },
    'stats-card-2': {
        name: 'stats-card-2',
        displayName: 'Stats Card — Users',
        filePath: 'src/app/components/StatsCards.tsx',
        dataAttribute: 'stats-card-2',
        editableProperties: [
            { property: 'value', type: 'text', currentValue: '2,847' },
            { property: 'label', type: 'text', currentValue: 'Active Users' },
            { property: 'backgroundColor', type: 'color', currentValue: 'var(--bg-card)' },
        ],
    },
    'stats-card-3': {
        name: 'stats-card-3',
        displayName: 'Stats Card — Tasks',
        filePath: 'src/app/components/StatsCards.tsx',
        dataAttribute: 'stats-card-3',
        editableProperties: [
            { property: 'value', type: 'text', currentValue: '94.2%' },
            { property: 'label', type: 'text', currentValue: 'Completion Rate' },
            { property: 'backgroundColor', type: 'color', currentValue: 'var(--bg-card)' },
        ],
    },
    'action-button': {
        name: 'action-button',
        displayName: 'Action Button',
        filePath: 'src/app/components/ActionButton.tsx',
        dataAttribute: 'action-button',
        editableProperties: [
            { property: 'text', type: 'text', currentValue: 'Generate Report' },
            { property: 'backgroundColor', type: 'color', currentValue: 'var(--gradient-primary)' },
            { property: 'borderRadius', type: 'size', currentValue: 'var(--radius-md)' },
            { property: 'fontSize', type: 'size', currentValue: '0.9rem' },
        ],
    },
    'profile-card': {
        name: 'profile-card',
        displayName: 'User Profile Card',
        filePath: 'src/app/components/ProfileCard.tsx',
        dataAttribute: 'profile-card',
        editableProperties: [
            { property: 'name', type: 'text', currentValue: 'Sarah Chen' },
            { property: 'role', type: 'text', currentValue: 'Senior Product Designer' },
            { property: 'backgroundColor', type: 'color', currentValue: 'var(--bg-card)' },
        ],
    },
    'data-table': {
        name: 'data-table',
        displayName: 'Recent Activity Table',
        filePath: 'src/app/components/DataTable.tsx',
        dataAttribute: 'data-table',
        editableProperties: [
            { property: 'title', type: 'text', currentValue: 'Recent Activity' },
            { property: 'backgroundColor', type: 'color', currentValue: 'var(--bg-card)' },
        ],
    },
    'sidebar': {
        name: 'sidebar',
        displayName: 'Sidebar Navigation',
        filePath: 'src/app/components/Sidebar.tsx',
        dataAttribute: 'sidebar',
        editableProperties: [
            { property: 'backgroundColor', type: 'color', currentValue: 'var(--bg-secondary)' },
        ],
    },
};

/** Look up a component by its data-component attribute */
export function findComponent(dataAttribute: string): ComponentInfo | undefined {
    return COMPONENT_REGISTRY[dataAttribute];
}

/** Find the component at a given screen position by checking DOM elements */
export function findComponentAtPosition(x: number, y: number): ComponentInfo | null {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
        const attr = (el as HTMLElement).closest('[data-component]');
        if (attr) {
            const name = attr.getAttribute('data-component');
            if (name && COMPONENT_REGISTRY[name]) {
                return COMPONENT_REGISTRY[name];
            }
        }
    }
    return null;
}
