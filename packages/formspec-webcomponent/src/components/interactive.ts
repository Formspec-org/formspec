import { signal } from '@preact/signals-core';
import { effect } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';
import { touchFieldsInContainer } from '../submit/index.js';

/**
 * Renders a multi-step wizard with signal-driven panel visibility.
 * Creates a step progress indicator (numbered spans), prev/next navigation buttons, and optional skip button.
 * The last step shows "Finish" instead of "Next". Panel switching uses a Preact signal for the current step index.
 */
export const WizardPlugin: ComponentPlugin = {
    type: 'Wizard',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-wizard';
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);

        const children: any[] = comp.children || [];
        if (children.length === 0) return;

        const defaultStep = 0;
        const currentStep = signal(defaultStep);
        const setStep = (nextStep: number) => {
            const bounded = Math.max(0, Math.min(children.length - 1, Math.trunc(nextStep)));
            currentStep.value = bounded;
        };

        // Progress indicator
        if (comp.showProgress !== false) {
            const progress = document.createElement('div');
            progress.className = 'formspec-wizard-steps';
            el.appendChild(progress);

            ctx.cleanupFns.push(effect(() => {
                const step = currentStep.value;
                progress.innerHTML = '';
                for (let i = 0; i < children.length; i++) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'formspec-wizard-step-wrapper';

                    const indicator = document.createElement('span');
                    indicator.className = 'formspec-wizard-step';
                    if (i === step) indicator.classList.add('formspec-wizard-step--active');
                    if (i < step) indicator.classList.add('formspec-wizard-step--completed');
                    indicator.textContent = `${i + 1}`;
                    wrapper.appendChild(indicator);

                    if (children[i]?.title) {
                        const label = document.createElement('span');
                        label.className = 'formspec-wizard-step-label';
                        if (i === step) label.classList.add('formspec-wizard-step-label--active');
                        label.textContent = children[i].title;
                        wrapper.appendChild(label);
                    }

                    progress.appendChild(wrapper);
                }
            }));
        }

        // Step panels
        const panels: HTMLElement[] = [];
        for (let i = 0; i < children.length; i++) {
            const panel = document.createElement('div');
            panel.className = 'formspec-wizard-panel';
            if (i !== defaultStep) panel.classList.add('formspec-hidden');
            ctx.renderComponent(children[i], panel, ctx.prefix);
            el.appendChild(panel);
            panels.push(panel);
        }

        // Reactively show/hide panels
        ctx.cleanupFns.push(effect(() => {
            const step = currentStep.value;
            panels.forEach((p, idx) => {
                p.classList.toggle('formspec-hidden', idx !== step);
            });
        }));

        // Navigation buttons
        const nav = document.createElement('div');
        nav.className = 'formspec-wizard-nav';

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'formspec-wizard-prev';
        prevBtn.textContent = 'Previous';
        prevBtn.addEventListener('click', () => {
            if (currentStep.value > 0) setStep(currentStep.value - 1);
        });

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'formspec-wizard-next';
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', () => {
            if (currentStep.value < children.length - 1) {
                // Soft validation: touch all fields in the current panel so inline
                // errors become visible. Navigation still proceeds immediately.
                const currentPanel = panels[currentStep.value];
                if (currentPanel) {
                    touchFieldsInContainer(currentPanel, ctx.touchedFields, ctx.touchedVersion);
                }
                setStep(currentStep.value + 1);
            }
        });

        nav.appendChild(prevBtn);

        if (comp.allowSkip) {
            const skipBtn = document.createElement('button');
            skipBtn.type = 'button';
            skipBtn.className = 'formspec-wizard-skip';
            skipBtn.textContent = 'Skip';
            skipBtn.addEventListener('click', () => {
                if (currentStep.value < children.length - 1) setStep(currentStep.value + 1);
            });
            nav.appendChild(skipBtn);
        }

        nav.appendChild(nextBtn);
        el.appendChild(nav);

        const onSetStep = (event: Event) => {
            const customEvent = event as CustomEvent<{ index?: unknown }>;
            const requestedIndex = Number(customEvent.detail?.index);
            if (!Number.isFinite(requestedIndex)) return;
            setStep(requestedIndex);
            event.stopPropagation();
        };
        el.addEventListener('formspec-wizard-set-step', onSetStep as EventListener);
        ctx.cleanupFns.push(() => {
            el.removeEventListener('formspec-wizard-set-step', onSetStep as EventListener);
        });

        // Reactively enable/disable prev/next and emit page-change event
        ctx.cleanupFns.push(effect(() => {
            const step = currentStep.value;
            const total = children.length;
            prevBtn.disabled = step === 0;
            nextBtn.disabled = step === total - 1;
            prevBtn.classList.toggle('formspec-hidden', step === 0);

            const skipBtn = el.querySelector('.formspec-wizard-skip') as HTMLButtonElement;
            if (skipBtn) {
                // Hide skip on the last step
                skipBtn.classList.toggle('formspec-hidden', step === total - 1);
            }

            nextBtn.textContent = step === total - 1 ? 'Finish' : 'Next';

            el.dispatchEvent(new CustomEvent('formspec-page-change', {
                detail: {
                    index: step,
                    total: total,
                    title: children[step]?.title || '',
                },
                bubbles: true,
                composed: true,
            }));
        }));
    }
};

/**
 * Renders a tabbed interface with click-based tab switching.
 * Supports configurable tab bar position (top or bottom) and default active tab.
 * Each tab button toggles visibility of its corresponding panel.
 */
export const TabsPlugin: ComponentPlugin = {
    type: 'Tabs',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-tabs';
        const position = comp.position || 'top';
        if (position !== 'top') el.dataset.position = position;
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);

        const tabLabels: string[] = comp.tabLabels || [];
        const children: any[] = comp.children || [];
        const defaultTab = comp.defaultTab || 0;
        const activeTab = signal(defaultTab);
        const setActiveTab = (nextTab: number) => {
            const bounded = Math.max(0, Math.min(children.length - 1, Math.trunc(nextTab)));
            activeTab.value = bounded;
        };

        // Tab bar
        const tabBar = document.createElement('div');
        tabBar.className = 'formspec-tab-bar';

        // Panel container
        const panelContainer = document.createElement('div');
        panelContainer.className = 'formspec-tab-panels';

        // Tab panels
        const panels: HTMLElement[] = [];
        for (let i = 0; i < children.length; i++) {
            const panel = document.createElement('div');
            panel.className = 'formspec-tab-panel';
            if (i !== defaultTab) panel.classList.add('formspec-hidden');
            ctx.renderComponent(children[i], panel, ctx.prefix);
            panelContainer.appendChild(panel);
            panels.push(panel);
        }

        // Tab buttons
        const buttons: HTMLButtonElement[] = [];
        for (let i = 0; i < children.length; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = tabLabels[i] || `Tab ${i + 1}`;
            btn.className = 'formspec-tab';
            btn.addEventListener('click', () => {
                setActiveTab(i);
            });
            tabBar.appendChild(btn);
            buttons.push(btn);
        }

        ctx.cleanupFns.push(effect(() => {
            const active = activeTab.value;
            panels.forEach((p, idx) => p.classList.toggle('formspec-hidden', idx !== active));
            buttons.forEach((b, idx) => b.classList.toggle('formspec-tab--active', idx === active));
        }));

        const onSetActive = (event: Event) => {
            const customEvent = event as CustomEvent<{ index?: unknown }>;
            const requestedIndex = Number(customEvent.detail?.index);
            if (!Number.isFinite(requestedIndex)) return;
            setActiveTab(requestedIndex);
            event.stopPropagation();
        };
        el.addEventListener('formspec-tabs-set-active', onSetActive as EventListener);
        ctx.cleanupFns.push(() => {
            el.removeEventListener('formspec-tabs-set-active', onSetActive as EventListener);
        });

        // Placement based on position
        if (position === 'bottom') {
            el.appendChild(panelContainer);
            el.appendChild(tabBar);
        } else {
            el.appendChild(tabBar);
            el.appendChild(panelContainer);
        }
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
        const pendingLabel = comp.pendingLabel || 'Submitting…';
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
