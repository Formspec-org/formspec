/** @filedesc Interactive component plugins: Tabs and SubmitButton. */
import { effect } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';
import { useTabs } from '../behaviors/tabs';
import { globalRegistry } from '../registry';

/** Resolve a component string via $component.<id>.<prop> locale key, falling back to inline. */
function resolveCompText(ctx: RenderContext, comp: any, prop: string, fallback: string): string {
    if (!comp.id) return fallback;
    return ctx.engine.resolveLocaleString(`$component.${comp.id}.${prop}`, fallback);
}

/** Renders a tabbed interface via the behavior-adapter pipeline. */
export const TabsPlugin: ComponentPlugin = {
    type: 'Tabs',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const behavior = useTabs(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('Tabs');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/**
 * Renders a submit button that invokes the host renderer's `submit()` API.
 * Supports submit mode selection and optional event dispatch control.
 */
export const SubmitButtonPlugin: ComponentPlugin = {
    type: 'SubmitButton',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const button = document.createElement('button');
        if (comp.id) button.id = comp.id;
        button.type = 'button';
        button.className = 'formspec-submit';
        const defaultLabel = resolveCompText(ctx, comp, 'label', comp.label || 'Submit');
        const pendingLabel = resolveCompText(ctx, comp, 'pendingLabel', comp.pendingLabel || 'Submitting\u2026');
        const disableWhenPending = comp.disableWhenPending !== false;
        button.textContent = defaultLabel;
        ctx.applyCssClass(button, comp);
        ctx.applyAccessibility(button, comp);
        ctx.applyStyle(button, comp.style);
        ctx.cleanupFns.push(effect(() => {
            const pending = ctx.submitPendingSignal.value;
            button.textContent = pending ? pendingLabel : defaultLabel;
            button.disabled = disableWhenPending ? pending : false;
        }));
        button.addEventListener('click', () => {
            ctx.submit({
                mode: comp.mode || 'submit',
                emitEvent: comp.emitEvent !== false,
            });
        });
        parent.appendChild(button);
    },
};
