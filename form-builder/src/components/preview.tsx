import { useEffect, useRef } from 'preact/hooks';
import { FormspecRender } from 'formspec-webcomponent';
import { assembledDefinition, definitionVersion } from '../state/definition';
import { engine, componentDoc, componentVersion } from '../state/project';
import { selectedPath } from '../state/selection';
import { findPathByBind } from '../logic/component-tree';

// Register the custom element in this window if not already done
if (!customElements.get('formspec-render')) {
    customElements.define('formspec-render', FormspecRender);
}

export function Preview() {
    const containerRef = useRef<HTMLDivElement>(null);
    const renderRef = useRef<any>(null);

    const hasEngine = engine.value !== null;

    // Mount the formspec-render element once
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const el = document.createElement('formspec-render') as any;
        container.appendChild(el);
        renderRef.current = el;

        // Sync initial state
        if (componentDoc.value) el.componentDocument = structuredClone(componentDoc.value);
        if (assembledDefinition.value) el.definition = structuredClone(assembledDefinition.value);

        // Handle clicks for selection
        const handleClick = (event: MouseEvent) => {
            const path = event.composedPath();
            for (const node of path) {
                if (node instanceof HTMLElement && (node.dataset.name || node.dataset.bind)) {
                    const bindKey = node.dataset.name || node.dataset.bind || '';

                    const docState = componentDoc.value;
                    if (docState) {
                        const normalizedBind = bindKey.replace(/\[\d+\]/g, '');
                        const treePath = findPathByBind(docState.tree, normalizedBind);
                        if (treePath !== null) {
                            selectedPath.value = treePath;
                            return;
                        }
                    }

                    selectedPath.value = bindKey;
                    break;
                }
            }
        };
        el.addEventListener('click', handleClick);

        return () => {
            el.removeEventListener('click', handleClick);
            el.remove();
            renderRef.current = null;
        };
    }, []);

    // Sync component document
    useEffect(() => {
        if (!renderRef.current) return;
        const docValue = componentDoc.value;
        renderRef.current.componentDocument = docValue ? structuredClone(docValue) : null;
    }, [componentVersion.value]);

    // Debounced definition sync
    useEffect(() => {
        if (!renderRef.current) return;
        const def = assembledDefinition.value;
        const timer = setTimeout(() => {
            if (renderRef.current) {
                try {
                    renderRef.current.definition = structuredClone(def);
                } catch (_e) { /* definition may be invalid */ }
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [definitionVersion.value]);

    // Highlight selected element inside the shadow DOM
    useEffect(() => {
        const path = selectedPath.value;
        const renderEl = renderRef.current;
        if (!path || !renderEl) return;

        const shadow = renderEl.shadowRoot;
        if (!shadow) return;

        if (!shadow.querySelector('#preview-highlight-styles')) {
            const style = document.createElement('style');
            style.id = 'preview-highlight-styles';
            style.textContent = `
                .preview-highlight {
                    outline: 2px solid #8b5cf6 !important;
                    outline-offset: 4px !important;
                    border-radius: 4px !important;
                    transition: outline 0.2s !important;
                }
                .preview-highlight-fade {
                    outline-color: transparent !important;
                }
            `;
            shadow.appendChild(style);
        }

        const targetEl = shadow.querySelector(`[data-name="${path}"]`) ||
            shadow.querySelector(`[data-name="${path.split('.').pop()}"]`) ||
            shadow.querySelector(`[data-name]`) as HTMLElement;

        if (!targetEl || !(targetEl instanceof HTMLElement)) return;

        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        targetEl.classList.add('preview-highlight');

        const fadeTimer = setTimeout(() => targetEl.classList.add('preview-highlight-fade'), 1000);
        const removeTimer = setTimeout(() => {
            targetEl.classList.remove('preview-highlight', 'preview-highlight-fade');
        }, 1500);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(removeTimer);
            targetEl.classList.remove('preview-highlight', 'preview-highlight-fade');
        };
    }, [selectedPath.value]);

    return (
        <div class="preview-panel">
            <div class="preview-header">
                <span class="preview-header-title">Live Preview</span>
                <div class="preview-meta-badge">Live</div>
            </div>
            <div class="preview-viewport">
                <div class="preview-container">
                    <div ref={containerRef} class="preview-render-host" />
                    {!hasEngine && (
                        <div class="preview-error">
                            Fix definition errors to see preview
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
