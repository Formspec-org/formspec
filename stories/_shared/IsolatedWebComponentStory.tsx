/** Shadow-root wrapper for web component stories when CSS isolation matters. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormspecRender, emitThemeTokens, globalRegistry } from '@formspec-org/webcomponent';
import type { RenderAdapter } from '@formspec-org/webcomponent';
import formspecDefaultCssUrl from '../../packages/formspec-webcomponent/src/formspec-default.css?url';
import formspecLayoutCssUrl from '../../packages/formspec-webcomponent/src/formspec-layout.css?url';
import uswdsCssUrl from '@uswds/uswds/css/uswds.css?url';
import type { StoryAppearance } from './storyAppearance';

if (!customElements.get('formspec-render')) {
    customElements.define('formspec-render', FormspecRender);
}

export interface IsolatedWebComponentStoryProps {
    definition: any;
    theme?: any;
    componentDocument?: any;
    adapter?: RenderAdapter;
    showSubmit?: boolean;
    maxWidth?: number;
    /** Optional initial field values to hydrate the engine before rendering. Must be set before definition. */
    initialData?: Record<string, any>;
    /** When true, all fields are touched on mount so validation errors display immediately. */
    touchAll?: boolean;
    /** Storybook-controlled appearance override. */
    appearance?: StoryAppearance;
    /** When true, comparison stories remove adapter field-width caps so panes use the same measure. */
    fillComparisonWidth?: boolean;
}

function useShadowRoot(stylesheets: string[], inlineStyles: string[]) {
    const hostRef = useRef<HTMLDivElement>(null);
    const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);

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

        inlineStyles.forEach((cssText) => {
            const style = document.createElement('style');
            style.textContent = cssText;
            shadow.appendChild(style);
        });

        const mount = document.createElement('div');
        shadow.appendChild(mount);
        setMountNode(mount);

        return () => {
            setMountNode(null);
            shadow.replaceChildren();
        };
    }, [stylesheets, inlineStyles]);

    return { hostRef, mountNode };
}

export function IsolatedWebComponentStory({
    definition,
    theme,
    componentDocument,
    adapter,
    showSubmit = true,
    maxWidth = 640,
    initialData,
    touchAll = false,
    appearance = 'system',
    fillComparisonWidth = false,
}: IsolatedWebComponentStoryProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const elementRef = useRef<FormspecRender | null>(null);

    const stylesheets = useMemo(() => {
        const urls = [formspecLayoutCssUrl];
        if (adapter?.name === 'uswds') {
            urls.push(uswdsCssUrl);
        } else {
            urls.push(formspecDefaultCssUrl);
        }
        return urls;
    }, [adapter?.name]);

    const inlineStyles = useMemo(() => {
        const styles = [
            `
                :host {
                    display: block;
                }
                .isolated-story-root {
                    display: block;
                }
            `,
        ];
        if (adapter?.integrationCSS) styles.push(adapter.integrationCSS);
        if (adapter?.name === 'uswds' && fillComparisonWidth) {
            styles.push(`
                .formspec-uswds-comparison-form {
                    max-width: 100%;
                }
                .formspec-uswds-comparison-form .usa-form-group,
                .formspec-uswds-comparison-form .usa-fieldset,
                .formspec-uswds-comparison-form .usa-form-group > .usa-input-group,
                .formspec-uswds-comparison-form .usa-form-group > .usa-range,
                .formspec-uswds-comparison-form .usa-form-group > .usa-file-input {
                    max-width: none !important;
                }
                .formspec-uswds-comparison-form .formspec-stack.grid-row.grid-gap > [class*='grid-col'] > .usa-form-group,
                .formspec-uswds-comparison-form .formspec-stack.grid-row.grid-gap > [class*='grid-col'] > .usa-fieldset,
                .formspec-uswds-comparison-form .formspec-stack.grid-row.grid-gap > [class*='grid-col'] > .usa-form-group > .usa-input-group,
                .formspec-uswds-comparison-form .formspec-stack.grid-row.grid-gap > [class*='grid-col'] > .usa-form-group > .usa-range,
                .formspec-uswds-comparison-form .formspec-stack.grid-row.grid-gap > [class*='grid-col'] > .usa-form-group > .usa-file-input {
                    max-width: none !important;
                }
            `);
        }
        return styles;
    }, [adapter, fillComparisonWidth]);

    const { hostRef, mountNode } = useShadowRoot(stylesheets, inlineStyles);

    useEffect(() => {
        const el = elementRef.current;
        if (!el) return;
        if (appearance === 'light' || appearance === 'dark') {
            el.setAttribute('data-formspec-appearance', appearance);
        } else {
            el.removeAttribute('data-formspec-appearance');
        }
    }, [appearance, mountNode]);

    useEffect(() => {
        if (!containerRef.current) return;

        const shadowHost = hostRef.current;

        if (adapter) {
            globalRegistry.registerAdapter(adapter);
            globalRegistry.setAdapter(adapter.name);
        } else {
            globalRegistry.setAdapter('default');
        }

        if (!elementRef.current) {
            const el = document.createElement('formspec-render') as FormspecRender;
            containerRef.current.appendChild(el);
            elementRef.current = el;
        }

        const el = elementRef.current;
        if (appearance === 'light' || appearance === 'dark') {
            el.setAttribute('data-formspec-appearance', appearance);
        } else {
            el.removeAttribute('data-formspec-appearance');
        }
        if (shadowHost) {
            shadowHost.style.cssText = '';
            if (theme?.tokens && typeof theme.tokens === 'object') {
                emitThemeTokens(theme.tokens as Record<string, string | number>, shadowHost);
            }
        }
        if (theme) el.themeDocument = theme;
        if (componentDocument) el.componentDocument = componentDocument;
        if (initialData) el.initialData = initialData;
        el.showSubmit = showSubmit;
        el.definition = definition;
        if (touchAll) {
            // Defer by one tick so the engine finishes rendering before we touch all fields
            queueMicrotask(() => el.touchAllFields?.());
        }

        return () => {
            globalRegistry.setAdapter('default');
            if (elementRef.current) {
                elementRef.current.remove();
                elementRef.current = null;
            }
        };
    }, [definition, theme, componentDocument, adapter, showSubmit, mountNode, initialData, touchAll]);

    const items = Array.isArray(definition?.items) ? definition.items : [];
    const allDisplayOnly =
        items.length > 0 && items.every((it: { type?: string }) => it.type === 'display');

    const inner =
        adapter?.name === 'uswds' ? (
            <div className="isolated-story-root">
                {/*
                  Comparison-story wrapper: the adapter integration CSS widens `.usa-form` when it
                  contains a Formspec container, so both panes render against the same available width.
                */}
                <form className={fillComparisonWidth ? 'usa-form formspec-uswds-comparison-form' : 'usa-form'}>
                    {definition?.title ? (
                        <h2 className={allDisplayOnly ? undefined : 'usa-sr-only'}>{definition.title}</h2>
                    ) : null}
                    <div ref={containerRef} />
                </form>
            </div>
        ) : (
            <div className="isolated-story-root" ref={containerRef} />
        );

    return (
        <div style={{ maxWidth, margin: '0 auto' }}>
            <div ref={hostRef} />
            {mountNode ? createPortal(inner, mountNode) : null}
        </div>
    );
}
