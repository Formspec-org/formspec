/** @filedesc Interactive component plugins: Wizard, Tabs, and SubmitButton. */
import { effect } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';
import { useWizard } from '../behaviors/wizard';
import { useTabs } from '../behaviors/tabs';
import { globalRegistry } from '../registry';

/** Renders a multi-step wizard via the behavior-adapter pipeline. */
export const WizardPlugin: ComponentPlugin = {
    type: 'Wizard',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const behavior = useWizard(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('Wizard');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

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
        const defaultLabel = comp.label || 'Submit';
        const pendingLabel = comp.pendingLabel || 'Submitting\u2026';
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
