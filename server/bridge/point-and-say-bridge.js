/**
 * Point & Say Bridge — injected into the target application
 *
 * This lightweight script enables communication between the target app
 * (running in an iframe) and the Point & Say UI (parent window).
 *
 * It handles:
 * - Click detection → finds data-component elements at click position
 * - Hover highlighting → shows a visual highlight on hoverable components
 * - postMessage communication → sends component info to parent
 *
 * Injected automatically by the Point & Say backend when a project is configured.
 * Removed automatically when the project is unconfigured.
 */
(function () {
    // Prevent double-injection
    if (window.__POINT_AND_SAY_BRIDGE__) return;
    window.__POINT_AND_SAY_BRIDGE__ = true;

    const HIGHLIGHT_COLOR = 'rgba(251, 140, 102, 0.15)';
    const HIGHLIGHT_BORDER = 'rgba(251, 140, 102, 0.6)';

    // Create highlight overlay element
    const overlay = document.createElement('div');
    overlay.id = 'pas-highlight-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: '99999',
        border: `2px solid ${HIGHLIGHT_BORDER}`,
        background: HIGHLIGHT_COLOR,
        borderRadius: '8px',
        transition: 'all 0.15s ease',
        display: 'none',
    });
    document.body.appendChild(overlay);

    // Create label element
    const label = document.createElement('div');
    label.id = 'pas-highlight-label';
    Object.assign(label.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: '100000',
        background: 'rgba(251, 140, 102, 0.95)',
        color: '#fff',
        fontSize: '11px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: '600',
        padding: '2px 8px',
        borderRadius: '4px',
        display: 'none',
        whiteSpace: 'nowrap',
    });
    document.body.appendChild(label);

    /** Walk up the DOM to find data-component elements */
    function findComponentsAtPoint(x, y) {
        const elements = document.elementsFromPoint(x, y);
        const seen = new Set();
        const results = [];

        for (const el of elements) {
            let current = el;
            while (current) {
                const attr = current.getAttribute('data-component');
                if (attr && !seen.has(attr)) {
                    seen.add(attr);
                    const rect = current.getBoundingClientRect();

                    // Get text preview
                    let textPreview = '';
                    const heading = current.querySelector('h1, h2, h3, h4, span, p, button');
                    if (heading && heading.textContent) {
                        textPreview = heading.textContent.trim().slice(0, 50);
                    }

                    results.push({
                        dataAttr: attr,
                        displayName: attr.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''),
                        description: textPreview || attr.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        elementType: inferElementType(attr, current),
                        bounds: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                        depth: results.length,
                    });
                }
                current = current.parentElement;
            }
        }

        return results;
    }

    /** Infer element type from data-component value */
    function inferElementType(attr, el) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'button' || attr.includes('button') || attr.includes('cta')) return 'button';
        if (attr.includes('card') || attr.includes('stat')) return 'card';
        if (attr.includes('chart') || attr.includes('graph') || attr.includes('revenue')) return 'chart';
        if (attr.includes('table') || attr.includes('transaction')) return 'table';
        if (attr.includes('hero') || attr.includes('banner') || attr.includes('header')) return 'section';
        if (attr.includes('sidebar') || attr.includes('nav')) return 'navigation';
        if (attr.includes('feed') || attr.includes('activity')) return 'card';
        return 'element';
    }

    /** Find the nearest data-component element at a point */
    function findNearestComponent(x, y) {
        const el = document.elementFromPoint(x, y);
        let current = el;
        while (current) {
            if (current.getAttribute && current.getAttribute('data-component')) {
                return current;
            }
            current = current.parentElement;
        }
        return null;
    }

    // ===== Hover Highlighting =====
    let lastHoveredAttr = null;

    document.addEventListener('mousemove', (e) => {
        const comp = findNearestComponent(e.clientX, e.clientY);
        if (comp) {
            const attr = comp.getAttribute('data-component');
            if (attr !== lastHoveredAttr) {
                lastHoveredAttr = attr;
                const rect = comp.getBoundingClientRect();
                Object.assign(overlay.style, {
                    display: 'block',
                    top: rect.top + 'px',
                    left: rect.left + 'px',
                    width: rect.width + 'px',
                    height: rect.height + 'px',
                });
                const displayName = attr.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
                label.textContent = displayName;
                Object.assign(label.style, {
                    display: 'block',
                    top: (rect.top - 24) + 'px',
                    left: rect.left + 'px',
                });
            }
        } else {
            if (lastHoveredAttr) {
                lastHoveredAttr = null;
                overlay.style.display = 'none';
                label.style.display = 'none';
            }
        }
    });

    // ===== Click → Send to Parent =====
    document.addEventListener('click', (e) => {
        // Don't intercept if user is interacting with form elements
        if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(e.target.tagName)) {
            // Still send component info but don't preventDefault
        }

        const components = findComponentsAtPoint(e.clientX, e.clientY);
        if (components.length > 0) {
            e.preventDefault();
            e.stopPropagation();

            // Hide highlight during selection
            overlay.style.display = 'none';
            label.style.display = 'none';

            window.parent.postMessage({
                type: 'PAS_COMPONENT_CLICK',
                components: components,
                clickX: e.clientX,
                clickY: e.clientY,
                iframeWidth: window.innerWidth,
                iframeHeight: window.innerHeight,
            }, '*');
        }
    }, true); // Capture phase to intercept before app handlers

    // ===== Listen for messages from parent =====
    window.addEventListener('message', (e) => {
        if (!e.data || !e.data.type) return;

        if (e.data.type === 'PAS_HIGHLIGHT') {
            // Highlight a specific component by data-component value
            const target = document.querySelector(`[data-component="${e.data.dataAttr}"]`);
            if (target) {
                const rect = target.getBoundingClientRect();
                Object.assign(overlay.style, {
                    display: 'block',
                    top: rect.top + 'px',
                    left: rect.left + 'px',
                    width: rect.width + 'px',
                    height: rect.height + 'px',
                });
            }
        }

        if (e.data.type === 'PAS_CLEAR_HIGHLIGHT') {
            overlay.style.display = 'none';
            label.style.display = 'none';
        }

        if (e.data.type === 'PAS_PING') {
            window.parent.postMessage({ type: 'PAS_PONG' }, '*');
        }
    });

    // Notify parent that bridge is ready
    window.parent.postMessage({ type: 'PAS_BRIDGE_READY' }, '*');

    console.log('[Point & Say] Bridge loaded ✓');
})();
