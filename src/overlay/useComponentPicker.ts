/**
 * useComponentPicker — DOM-based component identification
 *
 * Uses document.elementsFromPoint() to find all elements at a click position,
 * walks the DOM tree to find data-component attributes, and builds a
 * hierarchical list of selectable components.
 *
 * Now DYNAMIC — works with ANY project that has data-component attributes.
 * Falls back to smart inference when no registry is available.
 * Built-in component map is used as default, but can be overridden via
 * /api/configure which populates the backend component registry.
 */
import { useState, useCallback, useEffect, useRef } from 'react';

export interface PickerComponent {
    /** data-component attribute value */
    dataAttr: string;
    /** Display name for the component */
    displayName: string;
    /** Description of the element */
    description: string;
    /** The element type (tag + contextual info) */
    elementType: string;
    /** File path from the registry */
    filePath: string;
    /** Depth in the DOM tree (0 = deepest) */
    depth: number;
    /** The actual DOM element reference */
    element: HTMLElement;
    /** Bounding rect of the element */
    bounds: DOMRect;
}

export interface PickerState {
    /** Whether the picker is currently showing */
    isOpen: boolean;
    /** Position where the picker should appear */
    position: { x: number; y: number };
    /** List of components found at the click position */
    components: PickerComponent[];
    /** Currently highlighted component (hover) */
    highlightedIndex: number | null;
    /** The selected component */
    selected: PickerComponent | null;
}

interface ComponentFileInfo {
    name: string;
    filePath: string;
    description: string;
}

/** Built-in component file map (default dashboard) */
const BUILTIN_FILE_MAP: Record<string, ComponentFileInfo> = {
    'sidebar': { name: 'Sidebar', filePath: 'src/app/components/Sidebar.tsx', description: 'Navigation sidebar' },
    'sidebar-logo': { name: 'Sidebar', filePath: 'src/app/components/Sidebar.tsx', description: 'Logo icon' },
    'sidebar-nav': { name: 'Sidebar', filePath: 'src/app/components/Sidebar.tsx', description: 'Navigation menu' },
    'sidebar-nav-item': { name: 'Sidebar', filePath: 'src/app/components/Sidebar.tsx', description: 'Nav button' },
    'main-header': { name: 'App', filePath: 'src/App.tsx', description: 'Dashboard header' },
    'hero-section': { name: 'HeroSection', filePath: 'src/app/components/HeroSection.tsx', description: 'Hero banner with CTA' },
    'hero-title': { name: 'HeroSection', filePath: 'src/app/components/HeroSection.tsx', description: 'Hero title text' },
    'hero-subtitle': { name: 'HeroSection', filePath: 'src/app/components/HeroSection.tsx', description: 'Hero subtitle text' },
    'hero-cta': { name: 'HeroSection', filePath: 'src/app/components/HeroSection.tsx', description: 'Call-to-action button' },
    'stats-cards': { name: 'StatsCards', filePath: 'src/app/components/StatsCards.tsx', description: 'Stats card strip' },
    'stats-card-1': { name: 'StatsCards', filePath: 'src/app/components/StatsCards.tsx', description: 'Total Revenue card' },
    'stats-card-2': { name: 'StatsCards', filePath: 'src/app/components/StatsCards.tsx', description: 'Active Users card' },
    'stats-card-3': { name: 'StatsCards', filePath: 'src/app/components/StatsCards.tsx', description: 'Completion Rate card' },
    'stats-card-4': { name: 'StatsCards', filePath: 'src/app/components/StatsCards.tsx', description: 'Tasks Done card' },
    'stat-label': { name: 'StatsCards', filePath: 'src/app/components/StatsCards.tsx', description: 'Stat label text' },
    'stat-value': { name: 'StatsCards', filePath: 'src/app/components/StatsCards.tsx', description: 'Stat value number' },
    'stat-change': { name: 'StatsCards', filePath: 'src/app/components/StatsCards.tsx', description: 'Stat change indicator' },
    'analytics-chart': { name: 'AnalyticsChart', filePath: 'src/app/components/AnalyticsChart.tsx', description: 'Revenue growth chart' },
    'chart-header': { name: 'AnalyticsChart', filePath: 'src/app/components/AnalyticsChart.tsx', description: 'Chart title & tabs' },
    'chart-area': { name: 'AnalyticsChart', filePath: 'src/app/components/AnalyticsChart.tsx', description: 'Chart visualization' },
    'chart-footer': { name: 'AnalyticsChart', filePath: 'src/app/components/AnalyticsChart.tsx', description: 'Chart footer info' },
    'profile-card': { name: 'ProfileCard', filePath: 'src/app/components/ProfileCard.tsx', description: 'User profile card' },
    'profile-avatar': { name: 'ProfileCard', filePath: 'src/app/components/ProfileCard.tsx', description: 'Profile avatar' },
    'profile-name': { name: 'ProfileCard', filePath: 'src/app/components/ProfileCard.tsx', description: 'Profile name text' },
    'profile-role': { name: 'ProfileCard', filePath: 'src/app/components/ProfileCard.tsx', description: 'Profile role text' },
    'profile-stats': { name: 'ProfileCard', filePath: 'src/app/components/ProfileCard.tsx', description: 'Profile stats row' },
    'data-table': { name: 'DataTable', filePath: 'src/app/components/DataTable.tsx', description: 'Recent activity table' },
    'data-table-header': { name: 'DataTable', filePath: 'src/app/components/DataTable.tsx', description: 'Table header with filter' },
    'data-table-row': { name: 'DataTable', filePath: 'src/app/components/DataTable.tsx', description: 'Table data row' },
    'action-button': { name: 'ActionButton', filePath: 'src/app/components/ActionButton.tsx', description: 'Quick Action button' },
    'status-bar': { name: 'StatusBar', filePath: 'src/overlay/StatusBar.tsx', description: 'Pipeline status bar' },
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Convert a data-component attribute value into a human-readable display name.
 * e.g. "hero-banner" → "HeroBanner", "stat-card" → "StatCard"
 */
function inferDisplayName(dataAttr: string): string {
    return dataAttr
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

/**
 * Infer a file path from a data-component attribute value.
 * Uses naming conventions: "hero-banner" → "src/components/HeroBanner.tsx"
 */
function inferFilePath(dataAttr: string): string {
    const name = inferDisplayName(dataAttr);
    return `src/components/${name}.tsx`;
}

/**
 * Infer a description from the element and its data-component value.
 */
function inferDescription(dataAttr: string, el: HTMLElement): string {
    const parts = dataAttr.split('-');
    const typeWords = parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return typeWords;
}

/**
 * Find all data-component elements at a given point, ordered from
 * deepest (most specific) to shallowest (most general).
 */
function findComponentsAtPoint(
    x: number,
    y: number,
    dynamicMap: Record<string, ComponentFileInfo>,
): PickerComponent[] {
    const elements = document.elementsFromPoint(x, y) as HTMLElement[];
    const seen = new Set<string>();
    const results: PickerComponent[] = [];

    for (const el of elements) {
        // Walk from the element itself upward
        let current: HTMLElement | null = el;
        while (current) {
            const dataAttr = current.getAttribute('data-component');
            if (dataAttr && !seen.has(dataAttr)) {
                seen.add(dataAttr);

                // Look up in the dynamic map first, then built-in, then infer
                const info = dynamicMap[dataAttr] || BUILTIN_FILE_MAP[dataAttr];

                const displayName = info?.name || inferDisplayName(dataAttr);
                const filePath = info?.filePath || inferFilePath(dataAttr);
                const baseDescription = info?.description || inferDescription(dataAttr, current);

                // Get a text preview from the element
                const textPreview = getTextPreview(current);
                const description = textPreview
                    ? `${baseDescription} — "${textPreview}"`
                    : baseDescription;

                results.push({
                    dataAttr,
                    displayName,
                    description,
                    elementType: getElementType(current),
                    filePath,
                    depth: results.length,
                    element: current,
                    bounds: current.getBoundingClientRect(),
                });
            }
            current = current.parentElement;
        }
    }

    return results;
}

/** Get a short text preview from an element (first meaningful text) */
function getTextPreview(el: HTMLElement): string {
    // Try direct text content first
    const directText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent?.trim())
        .filter(Boolean)
        .join(' ');

    if (directText && directText.length > 0 && directText.length < 50) {
        return directText;
    }

    // Try first heading or span
    const heading = el.querySelector('h1, h2, h3, h4, h5, h6, span, p, button');
    if (heading?.textContent) {
        const text = heading.textContent.trim();
        if (text.length < 50) return text;
        return text.slice(0, 47) + '...';
    }

    return '';
}

/** Get a user-friendly element type description */
function getElementType(el: HTMLElement): string {
    const tag = el.tagName.toLowerCase();
    const classList = Array.from(el.classList);
    const dataAttr = el.getAttribute('data-component') || '';

    if (tag === 'button' || el.getAttribute('role') === 'button') return 'button';
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return tag;
    if (tag === 'table') return 'table';
    if (tag === 'nav') return 'navigation';
    if (tag === 'aside') return 'sidebar';
    if (tag === 'section') return 'section';
    if (tag === 'svg') return 'chart';

    // Check data-component value for type hints
    if (dataAttr.includes('button') || dataAttr.includes('cta')) return 'button';
    if (dataAttr.includes('card')) return 'card';
    if (dataAttr.includes('chart') || dataAttr.includes('graph')) return 'chart';
    if (dataAttr.includes('table') || dataAttr.includes('transaction')) return 'table';
    if (dataAttr.includes('hero') || dataAttr.includes('banner')) return 'section';
    if (dataAttr.includes('sidebar') || dataAttr.includes('nav')) return 'navigation';
    if (dataAttr.includes('stat')) return 'stat';
    if (dataAttr.includes('feed') || dataAttr.includes('activity')) return 'card';
    if (dataAttr.includes('header')) return 'section';

    if (classList.some(c => c.includes('card'))) return 'card';
    if (classList.some(c => c.includes('chart'))) return 'chart';
    if (classList.some(c => c.includes('table'))) return 'table';
    if (classList.some(c => c.includes('hero'))) return 'section';
    if (classList.some(c => c.includes('button'))) return 'button';
    if (classList.some(c => c.includes('stat'))) return 'stat';

    return 'element';
}

export function useComponentPicker() {
    const [pickerState, setPickerState] = useState<PickerState>({
        isOpen: false,
        position: { x: 0, y: 0 },
        components: [],
        highlightedIndex: null,
        selected: null,
    });

    // Dynamic component map populated from backend scan results
    const dynamicMapRef = useRef<Record<string, ComponentFileInfo>>({});

    // Load dynamic component map from backend on mount
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/project-info`);
                if (!res.ok) return;
                const data = await res.json();
                if (data.scan?.components) {
                    const map: Record<string, ComponentFileInfo> = {};
                    for (const comp of data.scan.components) {
                        // Map each data-component attribute to file info
                        if (comp.dataAttributes && comp.dataAttributes.length > 0) {
                            for (const attr of comp.dataAttributes) {
                                map[attr] = {
                                    name: comp.name,
                                    filePath: comp.filePath,
                                    description: inferDescription(attr, document.createElement('div')),
                                };
                            }
                        }
                        // Also map by lowercase name
                        const nameKey = comp.name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
                        if (!map[nameKey]) {
                            map[nameKey] = {
                                name: comp.name,
                                filePath: comp.filePath,
                                description: `${comp.elementType || 'component'}`,
                            };
                        }
                    }
                    dynamicMapRef.current = map;
                    console.log(`[Picker] Loaded ${Object.keys(map).length} components from backend`);
                }
            } catch {
                // Silent fail — will use built-in map
            }
        })();
    }, []);

    /** Open the picker at a click position */
    const openPicker = useCallback((x: number, y: number) => {
        const components = findComponentsAtPoint(x, y, dynamicMapRef.current);

        if (components.length === 0) {
            // No components found — close any existing picker
            setPickerState(prev => ({ ...prev, isOpen: false, components: [], selected: null }));
            return;
        }

        // If only one component, auto-select it
        if (components.length === 1) {
            setPickerState({
                isOpen: false,
                position: { x, y },
                components,
                highlightedIndex: null,
                selected: components[0],
            });
            return;
        }

        // Multiple components — show picker
        setPickerState({
            isOpen: true,
            position: { x, y },
            components,
            highlightedIndex: 0,
            selected: null,
        });
    }, []);

    /** Select a component by index */
    const selectComponent = useCallback((index: number) => {
        setPickerState(prev => {
            const component = prev.components[index];
            if (!component) return prev;
            return {
                ...prev,
                isOpen: false,
                selected: component,
                highlightedIndex: null,
            };
        });
    }, []);

    /** Select by voice command (fuzzy match on name/description) */
    const selectByVoice = useCallback((text: string): boolean => {
        const lower = text.toLowerCase();

        // Check for ordinal/number selection
        const numberMatch = lower.match(/(?:select |choose |pick |the )?(first|second|third|fourth|1st|2nd|3rd|4th|one|two|three|four|\d+)/);
        if (numberMatch) {
            const word = numberMatch[1];
            const numMap: Record<string, number> = {
                'first': 0, '1st': 0, 'one': 0, '1': 0,
                'second': 1, '2nd': 1, 'two': 1, '2': 1,
                'third': 2, '3rd': 2, 'three': 2, '3': 2,
                'fourth': 3, '4th': 3, 'four': 3, '4': 3,
            };
            const index = numMap[word] ?? parseInt(word) - 1;
            if (!isNaN(index) && index >= 0) {
                setPickerState(prev => {
                    if (index < prev.components.length) {
                        return { ...prev, isOpen: false, selected: prev.components[index], highlightedIndex: null };
                    }
                    return prev;
                });
                return true;
            }
        }

        // Fuzzy match on component names and descriptions
        setPickerState(prev => {
            for (let i = 0; i < prev.components.length; i++) {
                const comp = prev.components[i];
                const searchable = `${comp.displayName} ${comp.description} ${comp.dataAttr} ${comp.elementType}`.toLowerCase();
                if (searchable.includes(lower) || lower.includes(comp.displayName.toLowerCase())) {
                    return { ...prev, isOpen: false, selected: comp, highlightedIndex: null };
                }
            }
            return prev;
        });

        return false;
    }, []);

    /** Highlight a component (on hover or dwell) */
    const highlightComponent = useCallback((index: number | null) => {
        setPickerState(prev => ({ ...prev, highlightedIndex: index }));
    }, []);

    /** Close the picker */
    const closePicker = useCallback(() => {
        setPickerState(prev => ({ ...prev, isOpen: false, highlightedIndex: null }));
    }, []);

    /** Reset everything */
    const resetPicker = useCallback(() => {
        setPickerState({
            isOpen: false,
            position: { x: 0, y: 0 },
            components: [],
            highlightedIndex: null,
            selected: null,
        });
    }, []);

    /** Refresh the dynamic component map (call after re-configuring project) */
    const refreshComponentMap = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/project-info`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.scan?.components) {
                const map: Record<string, ComponentFileInfo> = {};
                for (const comp of data.scan.components) {
                    if (comp.dataAttributes && comp.dataAttributes.length > 0) {
                        for (const attr of comp.dataAttributes) {
                            map[attr] = {
                                name: comp.name,
                                filePath: comp.filePath,
                                description: inferDescription(attr, document.createElement('div')),
                            };
                        }
                    }
                }
                dynamicMapRef.current = map;
            }
        } catch {
            // Silent fail
        }
    }, []);

    /** Open picker with pre-built component data (from bridge postMessage) */
    const openPickerWithComponents = useCallback((
        bridgeComponents: Array<{
            dataAttr: string;
            displayName: string;
            description: string;
            elementType: string;
            bounds: { top: number; left: number; width: number; height: number };
            depth: number;
        }>,
        x: number,
        y: number,
    ) => {
        const components: PickerComponent[] = bridgeComponents.map((bc) => {
            const info = dynamicMapRef.current[bc.dataAttr] || BUILTIN_FILE_MAP[bc.dataAttr];
            return {
                dataAttr: bc.dataAttr,
                displayName: info?.name || bc.displayName,
                description: bc.description,
                elementType: bc.elementType,
                filePath: info?.filePath || inferFilePath(bc.dataAttr),
                depth: bc.depth,
                element: document.createElement('div'),
                bounds: new DOMRect(bc.bounds.left, bc.bounds.top, bc.bounds.width, bc.bounds.height),
            };
        });

        if (components.length === 0) {
            setPickerState(prev => ({ ...prev, isOpen: false, components: [], selected: null }));
            return;
        }

        if (components.length === 1) {
            setPickerState({
                isOpen: false,
                position: { x, y },
                components,
                highlightedIndex: null,
                selected: components[0],
            });
            return;
        }

        setPickerState({
            isOpen: true,
            position: { x, y },
            components,
            highlightedIndex: 0,
            selected: null,
        });
    }, []);

    return {
        pickerState,
        openPicker,
        openPickerWithComponents,
        selectComponent,
        selectByVoice,
        highlightComponent,
        closePicker,
        resetPicker,
        refreshComponentMap,
    };
}
