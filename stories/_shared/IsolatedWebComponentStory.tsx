/** Shadow-root wrapper for web component stories when CSS isolation matters. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormspecRender, emitThemeTokens, globalRegistry } from '@formspec-org/webcomponent';
import type { RenderAdapter } from '@formspec-org/webcomponent';
import formspecDefaultCssUrl from '../../packages/formspec-webcomponent/src/formspec-default.css?url';
import formspecLayoutCssUrl from '../../packages/formspec-webcomponent/src/formspec-layout.css?url';
import uswdsCssUrl from '@uswds/uswds/css/uswds.css?url';

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
        return styles;
    }, [adapter]);

    const { hostRef, mountNode } = useShadowRoot(stylesheets, inlineStyles);

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
        if (shadowHost) {
            shadowHost.style.cssText = '';
            if (theme?.tokens && typeof theme.tokens === 'object') {
                emitThemeTokens(theme.tokens as Record<string, string | number>, shadowHost);
            }
        }
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
    }, [definition, theme, componentDocument, adapter, showSubmit, mountNode]);

    return (
        <div style={{ maxWidth, margin: '0 auto' }}>
            <div ref={hostRef} />
            {mountNode ? createPortal(
                <div className="isolated-story-root" ref={containerRef} />,
                mountNode,
            ) : null}
        </div>
    );
}
