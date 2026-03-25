/** @filedesc React-to-adapter bridge — wraps React components as AdapterRenderFns. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { AdapterRenderFn, AdapterContext } from 'formspec-webcomponent';

/**
 * Bridge a React component into the formspec adapter contract.
 *
 * The factory creates an `AdapterRenderFn` that:
 * 1. Creates a container div and appends it to the parent
 * 2. Renders the React component into that container via `flushSync`
 * 3. Registers cleanup (unmount + remove) on `actx.onDispose`
 *
 * A per-field container is required because `createRoot` takes exclusive
 * ownership of its target's children. Multiple sibling fields share the
 * same parent element in the webcomponent, so rendering directly into
 * parent would cause each field to wipe the previous one.
 *
 * React components should call `behavior.bind(refs)` in `useLayoutEffect`
 * so the bind completes within the synchronous `flushSync` window.
 */
export function createReactAdapter<B>(
    Component: React.ComponentType<{ behavior: B }>,
): AdapterRenderFn<B> {
    return (behavior: B, parent: HTMLElement, actx: AdapterContext) => {
        const container = document.createElement('div');
        parent.appendChild(container);
        const root = createRoot(container);

        flushSync(() => {
            root.render(<Component behavior={behavior} />);
        });

        actx.onDispose(() => {
            root.unmount();
            container.remove();
        });
    };
}
