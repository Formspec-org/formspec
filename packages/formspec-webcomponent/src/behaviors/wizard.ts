/** @filedesc Wizard behavior hook — manages multi-step navigation state. */
import { signal } from '@preact/signals-core';
import { effect } from '@preact/signals-core';
import type { WizardBehavior, WizardRefs, BehaviorContext } from './types';
import { touchFieldsInContainer } from '../submit/index.js';

export function useWizard(ctx: BehaviorContext, comp: any): WizardBehavior {
    const children: any[] = comp.children || [];
    const currentStep = signal(0);

    const setStep = (nextStep: number) => {
        const bounded = Math.max(0, Math.min(children.length - 1, Math.trunc(nextStep)));
        currentStep.value = bounded;
    };

    const steps = children.map((child: any, i: number) => ({
        id: child.id || `step-${i}`,
        title: child?.props?.title || `Step ${i + 1}`,
    }));

    const wizardId = comp.id;
    const compOverrides = {
        cssClass: comp.cssClass,
        style: comp.style,
        accessibility: comp.accessibility,
    };
    const showSideNav = comp.sidenav !== false;
    const showProgress = comp.showProgress !== false;
    const allowSkip = !!comp.allowSkip;

    // Track rendered panels for soft validation on Next
    let renderedPanels: HTMLElement[] = [];

    return {
        id: wizardId,
        compOverrides,
        steps,
        showSideNav,
        showProgress,
        allowSkip,

        activeStep(): number {
            return currentStep.value;
        },

        totalSteps(): number {
            return children.length;
        },

        canGoNext(): boolean {
            return currentStep.value < children.length - 1;
        },

        canGoPrev(): boolean {
            return currentStep.value > 0;
        },

        goNext(): void {
            if (currentStep.value < children.length - 1) {
                // Soft validation: touch fields in current panel
                const currentPanel = renderedPanels[currentStep.value];
                if (currentPanel) {
                    touchFieldsInContainer(currentPanel, ctx.touchedFields, ctx.touchedVersion);
                }
                setStep(currentStep.value + 1);
            }
        },

        goPrev(): void {
            if (currentStep.value > 0) {
                setStep(currentStep.value - 1);
            }
        },

        goToStep(index: number): void {
            setStep(index);
        },

        renderStep(index: number, parent: HTMLElement): void {
            ctx.renderComponent(children[index], parent, ctx.prefix);
            renderedPanels[index] = parent;
        },

        bind(refs: WizardRefs): () => void {
            const disposers: Array<() => void> = [];

            // Panel show/hide based on current step
            // The adapter creates panels and passes stepContent; we track all panels
            // via renderStep above. The adapter is responsible for show/hide toggling
            // using the activeStep() signal.

            // Step indicator updates
            if (refs.stepIndicators) {
                // Managed by adapter via activeStep() reactive reads
            }

            // Nav button reactivity
            disposers.push(effect(() => {
                const step = currentStep.value;
                const total = children.length;

                if (refs.prevButton) {
                    refs.prevButton.disabled = step === 0;
                    refs.prevButton.classList.toggle('formspec-hidden', step === 0);
                }
                if (refs.nextButton) {
                    refs.nextButton.disabled = total === 0;
                    refs.nextButton.textContent = step === total - 1 ? 'Submit' : 'Next';
                }

                // Dispatch page-change event
                refs.root.dispatchEvent(new CustomEvent('formspec-page-change', {
                    detail: {
                        index: step,
                        total: total,
                        title: (children[step] as any)?.props?.title || '',
                    },
                    bubbles: true,
                    composed: true,
                }));
            }));

            // formspec-wizard-set-step custom event
            const onSetStep = (event: Event) => {
                const customEvent = event as CustomEvent<{ index?: unknown }>;
                const requestedIndex = Number(customEvent.detail?.index);
                if (!Number.isFinite(requestedIndex)) return;
                setStep(requestedIndex);
                event.stopPropagation();
            };
            refs.root.addEventListener('formspec-wizard-set-step', onSetStep as EventListener);
            disposers.push(() => {
                refs.root.removeEventListener('formspec-wizard-set-step', onSetStep as EventListener);
            });

            // Next button: submit on last step, soft validate + advance otherwise
            if (refs.nextButton) {
                refs.nextButton.addEventListener('click', () => {
                    const isLastStep = currentStep.value === children.length - 1;
                    if (isLastStep) {
                        ctx.submit({ mode: 'submit', emitEvent: true });
                        return;
                    }
                    // Soft validation then advance
                    const currentPanel = renderedPanels[currentStep.value];
                    if (currentPanel) {
                        touchFieldsInContainer(currentPanel, ctx.touchedFields, ctx.touchedVersion);
                    }
                    setStep(currentStep.value + 1);
                });
            }

            // Prev button
            if (refs.prevButton) {
                refs.prevButton.addEventListener('click', () => {
                    if (currentStep.value > 0) setStep(currentStep.value - 1);
                });
            }

            return () => disposers.forEach(d => d());
        },
    };
}
