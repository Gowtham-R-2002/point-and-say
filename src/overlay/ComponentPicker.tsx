/**
 * ComponentPicker — Floating glassmorphism popup for component selection
 *
 * Appears at the click position showing a hierarchical list of
 * data-component elements found at that point. User can click to select,
 * or use voice commands ("select the first one").
 */
import { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCrosshairs,
    faLayerGroup,
    faCode,
    faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import type { PickerState } from './useComponentPicker';

interface ComponentPickerProps {
    state: PickerState;
    onSelect: (index: number) => void;
    onHighlight: (index: number | null) => void;
    onClose: () => void;
}

/** Map element types to emoji indicators */
const typeEmoji: Record<string, string> = {
    button: '🔘',
    card: '🃏',
    chart: '📊',
    table: '📋',
    section: '📐',
    sidebar: '📑',
    navigation: '🧭',
    stat: '📈',
    element: '🔷',
    input: '📝',
    select: '📝',
};

export function ComponentPicker({ state, onSelect, onHighlight, onClose }: ComponentPickerProps) {
    const pickerRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        if (!state.isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                onHighlight(
                    state.highlightedIndex === null
                        ? 0
                        : Math.min(state.highlightedIndex + 1, state.components.length - 1)
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                onHighlight(
                    state.highlightedIndex === null
                        ? 0
                        : Math.max(state.highlightedIndex - 1, 0)
                );
            } else if (e.key === 'Enter' && state.highlightedIndex !== null) {
                e.preventDefault();
                onSelect(state.highlightedIndex);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [state.isOpen, state.highlightedIndex, state.components.length, onClose, onHighlight, onSelect]);

    // Close on click outside
    useEffect(() => {
        if (!state.isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        // Delay to avoid catching the opening click
        const timer = setTimeout(() => {
            document.addEventListener('click', handleClickOutside, true);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('click', handleClickOutside, true);
        };
    }, [state.isOpen, onClose]);

    // Highlight element in the DOM when hovering picker items
    useEffect(() => {
        // Clear all existing highlights
        document.querySelectorAll('[data-picker-highlight]').forEach(el => {
            (el as HTMLElement).removeAttribute('data-picker-highlight');
        });

        if (state.highlightedIndex !== null && state.components[state.highlightedIndex]) {
            const comp = state.components[state.highlightedIndex];
            comp.element.setAttribute('data-picker-highlight', 'true');
        }

        return () => {
            document.querySelectorAll('[data-picker-highlight]').forEach(el => {
                (el as HTMLElement).removeAttribute('data-picker-highlight');
            });
        };
    }, [state.highlightedIndex, state.components]);

    if (!state.isOpen || state.components.length === 0) return null;

    // Position the picker near the click, but keep it within viewport
    const pickerWidth = 320;
    const pickerMaxHeight = 400;
    const margin = 16;

    let left = state.position.x + 20;
    let top = state.position.y - 20;

    // Keep within viewport
    if (left + pickerWidth + margin > window.innerWidth) {
        left = state.position.x - pickerWidth - 20;
    }
    if (top + pickerMaxHeight + margin > window.innerHeight) {
        top = window.innerHeight - pickerMaxHeight - margin;
    }
    if (top < margin) top = margin;
    if (left < margin) left = margin;

    return (
        <div
            ref={pickerRef}
            className="component-picker"
            style={{ left, top }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="picker-header">
                <FontAwesomeIcon icon={faCrosshairs} className="picker-header-icon" />
                <span>Select Component</span>
                <span className="picker-count">{state.components.length}</span>
            </div>

            {/* Component List */}
            <div className="picker-list">
                {state.components.map((comp, i) => (
                    <button
                        key={comp.dataAttr}
                        className={`picker-item ${state.highlightedIndex === i ? 'highlighted' : ''}`}
                        onClick={() => onSelect(i)}
                        onMouseEnter={() => onHighlight(i)}
                        onMouseLeave={() => onHighlight(null)}
                    >
                        <div className="picker-item-icon">
                            {i === 0 ? (
                                <FontAwesomeIcon icon={faCrosshairs} />
                            ) : (
                                <FontAwesomeIcon icon={faLayerGroup} />
                            )}
                        </div>

                        <div className="picker-item-content">
                            <div className="picker-item-name">
                                <span className="picker-item-type-emoji">
                                    {typeEmoji[comp.elementType] || '🔷'}
                                </span>
                                {comp.displayName}
                                {comp.dataAttr !== comp.displayName.toLowerCase() && (
                                    <span className="picker-item-attr">
                                        {comp.dataAttr}
                                    </span>
                                )}
                            </div>
                            <div className="picker-item-desc">{comp.description}</div>
                            <div className="picker-item-file">
                                <FontAwesomeIcon icon={faCode} style={{ fontSize: '0.55rem', marginRight: 4 }} />
                                {comp.filePath}
                            </div>
                        </div>

                        <div className="picker-item-arrow">
                            <FontAwesomeIcon icon={faChevronRight} />
                        </div>
                    </button>
                ))}
            </div>

            {/* Footer hint */}
            <div className="picker-footer">
                <span>Click to select • Say "select the first one" • Esc to close</span>
            </div>
        </div>
    );
}
