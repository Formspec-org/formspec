/** React wrapper for rendering formspec-webcomponent stories. */
import React, { useRef, useEffect } from 'react';
import { FormspecRender, globalRegistry } from '@formspec-org/webcomponent';
import type { RenderAdapter } from '@formspec-org/webcomponent';
// Web component visual styling — loaded alongside the structural formspec-layout.css
// that the package imports. Shares class names with formspec-react's formspec.css but
// provides the visual treatment the web component adapter actually expects.
import '@formspec-org/webcomponent/formspec-default.css';

// Register the custom element once
if (!customElements.get('formspec-render')) {
    customElements.define('formspec-render', FormspecRender);
}

export interface WebComponentStoryProps {
    /** The Formspec definition JSON. */
    definition: any;
    /** Optional theme document. */
    theme?: any;
    /** Optional component document for layout planning. */
    componentDocument?: any;
    /** Optional adapter to apply (e.g., uswdsAdapter). */
    adapter?: RenderAdapter;
    /** Whether to show a submit button. Defaults to true. */
    showSubmit?: boolean;

}

/** Mounts a <formspec-render> custom element inside a React story. */
export function WebComponentStory({ definition, theme, componentDocument, adapter, showSubmit = true }: WebComponentStoryProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const elementRef = useRef<FormspecRender | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Register adapter if provided
        if (adapter) {
            globalRegistry.registerAdapter(adapter);
            globalRegistry.setAdapter(adapter.name);
        } else {
            globalRegistry.setAdapter('default');
        }

        // Create element if not yet created
        if (!elementRef.current) {
            const el = document.createElement('formspec-render') as FormspecRender;
            containerRef.current.appendChild(el);
            elementRef.current = el;
        }

        const el = elementRef.current;
        // Set theme and component doc before definition — definition triggers engine creation
        if (theme) el.themeDocument = theme;
        if (componentDocument) el.componentDocument = componentDocument;
        el.showSubmit = showSubmit;
        el.definition = definition;

        return () => {
            globalRegistry.setAdapter('default');
            if (elementRef.current) {
                elementRef.current.remove();
                elementRef.current = null;
            }
        };
    }, [definition, theme, componentDocument, adapter, showSubmit]);

    return <div ref={containerRef} />;
}
