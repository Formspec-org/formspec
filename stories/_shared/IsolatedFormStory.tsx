/** Shadow-root wrapper for React stories — CSS isolation from WC styles. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormspecForm } from '@formspec-org/react';
import type { SubmitResult, ComponentMap } from '@formspec-org/react';
import formspecReactCssUrl from '../../packages/formspec-react/src/formspec.css?url';

export interface IsolatedFormStoryProps {
    /** The Formspec definition JSON. */
    definition: any;
    /** Optional theme document. */
    theme?: any;
    /** Optional component map overrides. */
    components?: ComponentMap;
    /** Optional component document for layout planning. */
    componentDocument?: any;
    /** Optional initial data. */
    initialData?: Record<string, any>;
    /** Whether to show a submit button. Defaults to true. */
    showSubmit?: boolean;
    /** Optional className on the form container. */
    className?: string;
}

/** Renders a FormspecForm inside an isolated shadow root. */
export function IsolatedFormStory({
    definition,
    theme,
    components,
    componentDocument,
    initialData,
    showSubmit = true,
    className,
}: IsolatedFormStoryProps) {
    const hostRef = useRef<HTMLDivElement>(null);
    const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);
    const [result, setResult] = useState<SubmitResult | null>(null);

    const stylesheets = useMemo(() => [formspecReactCssUrl], []);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
        shadow.replaceChildren();

        stylesheets.forEach((href) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            shadow.appendChild(link);
        });

        const mount = document.createElement('div');
        shadow.appendChild(mount);
        setMountNode(mount);

        return () => {
            setMountNode(null);
            shadow.replaceChildren();
        };
    }, [stylesheets]);

    return (
        <>
            <div ref={hostRef} />
            {mountNode ? createPortal(
                <div>
                    <FormspecForm
                        definition={definition}
                        themeDocument={theme}
                        components={components}
                        componentDocument={componentDocument}
                        initialData={initialData}
                        onSubmit={showSubmit ? setResult : undefined}
                        className={className}
                    />
                    {result && (
                        <details style={{ marginTop: 16 }}>
                            <summary>
                                {result.validationReport?.valid ? 'Valid' : 'Invalid'} — Submit Result
                            </summary>
                            <pre style={{ fontSize: 12, overflow: 'auto', maxHeight: 300 }}>
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </details>
                    )}
                </div>,
                mountNode,
            ) : null}
        </>
    );
}
