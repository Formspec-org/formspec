/** @filedesc Wizard layout component — multi-step form navigation with soft validation. */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { LayoutNode } from 'formspec-layout';
import type { LayoutComponentProps } from '../../component-map';
import { useFormspecContext } from '../../context';

// ---- helpers ----------------------------------------------------------------

/** Collect all bindPaths in a LayoutNode subtree (fields and groups). */
function collectBindPaths(node: LayoutNode): string[] {
    const paths: string[] = [];
    if (node.bindPath) paths.push(node.bindPath);
    for (const child of node.children) {
        paths.push(...collectBindPaths(child));
    }
    return paths;
}

/** Focus the first focusable element inside a container. */
function focusFirstIn(container: HTMLElement | null): void {
    if (!container) return;
    const el = container.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    el?.focus();
}

// ---- component --------------------------------------------------------------

/**
 * Wizard layout — renders one step at a time with Previous / Next / Submit
 * navigation, optional progress bar, and soft validation on Next.
 */
export function Wizard({ node, children }: LayoutComponentProps): React.JSX.Element {
    const { touchField, engine, onSubmit } = useFormspecContext();

    const stepNodes = node.children; // LayoutNode[] — one per step
    const stepChildren = React.Children.toArray(children); // ReactNode[] — rendered steps
    const totalSteps = stepChildren.length;

    const [currentStep, setCurrentStep] = useState(0);
    const stepPanelRef = useRef<HTMLDivElement>(null);
    const announcerRef = useRef<HTMLDivElement>(null);

    const showProgress = node.props?.showProgress !== false;
    const allowSkip = !!node.props?.allowSkip;

    const stepTitle = (idx: number): string =>
        (stepNodes[idx]?.props?.title as string | undefined) ||
        (stepNodes[idx]?.fieldItem?.label as string | undefined) ||
        `Step ${idx + 1}`;

    // Soft-touch all fields in the current step to reveal validation errors.
    // Does NOT block navigation — just makes errors visible.
    const touchCurrentStep = useCallback(() => {
        const stepNode = stepNodes[currentStep];
        if (!stepNode) return;
        const paths = collectBindPaths(stepNode);
        for (const path of paths) {
            touchField(path);
        }
    }, [currentStep, stepNodes, touchField]);

    /** Returns true if the current step has any validation errors. */
    const currentStepHasErrors = useCallback((): boolean => {
        const stepNode = stepNodes[currentStep];
        if (!stepNode) return false;
        const paths = collectBindPaths(stepNode);
        for (const path of paths) {
            const vm = engine.getFieldVM(path);
            if (vm && vm.errors.value.some((e) => e.severity === 'error')) return true;
        }
        return false;
    }, [currentStep, stepNodes, engine]);

    const goTo = useCallback((next: number) => {
        const bounded = Math.max(0, Math.min(totalSteps - 1, next));
        setCurrentStep(bounded);
    }, [totalSteps]);

    const handleNext = useCallback(() => {
        touchCurrentStep();
        if (currentStepHasErrors()) return; // stay on step — errors are now visible
        if (currentStep < totalSteps - 1) {
            goTo(currentStep + 1);
        }
    }, [touchCurrentStep, currentStepHasErrors, currentStep, totalSteps, goTo]);

    const handlePrev = useCallback(() => {
        if (currentStep > 0) goTo(currentStep - 1);
    }, [currentStep, goTo]);

    const handleSkip = useCallback(() => {
        if (currentStep < totalSteps - 1) goTo(currentStep + 1);
    }, [currentStep, totalSteps, goTo]);

    // Focus first element in new step and update announcer after step change.
    useEffect(() => {
        focusFirstIn(stepPanelRef.current);
    }, [currentStep]);

    const title = stepTitle(currentStep);
    const isFirst = currentStep === 0;
    const isLast = currentStep === totalSteps - 1;

    return (
        <div
            className="formspec-wizard"
            role="group"
            aria-label={`Wizard: Step ${currentStep + 1} of ${totalSteps}`}
        >
            {/* Progress bar */}
            {showProgress && totalSteps > 1 && (
                <div className="formspec-wizard-steps" aria-hidden="true">
                    {stepNodes.map((_, idx) => (
                        <div key={idx} className="formspec-wizard-step-wrapper">
                            <span
                                className={[
                                    'formspec-wizard-step',
                                    idx === currentStep ? 'formspec-wizard-step--active' : '',
                                    idx < currentStep ? 'formspec-wizard-step--completed' : '',
                                ].filter(Boolean).join(' ')}
                            >
                                {idx < currentStep ? '\u2713' : idx + 1}
                            </span>
                            <span
                                className={[
                                    'formspec-wizard-step-label',
                                    idx === currentStep ? 'formspec-wizard-step-label--active' : '',
                                ].filter(Boolean).join(' ')}
                            >
                                {stepTitle(idx)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Step indicator — visible; screen reader users navigate to the current step panel */}
            <div
                className="formspec-wizard-step-indicator"
                ref={announcerRef}
            >
                {`Step ${currentStep + 1} of ${totalSteps}: ${title}`}
                {isLast ? ' — final step' : ''}
            </div>

            {/* Current step panel */}
            <div
                className="formspec-wizard-panel"
                role="region"
                aria-label={title}
                ref={stepPanelRef}
            >
                {stepChildren[currentStep]}
            </div>

            {/* Navigation */}
            <div className="formspec-wizard-nav">
                <button
                    type="button"
                    className="formspec-wizard-prev"
                    onClick={handlePrev}
                    disabled={isFirst}
                    aria-disabled={isFirst}
                    aria-label="Previous step"
                >
                    Previous
                </button>

                {allowSkip && !isLast && (
                    <button
                        type="button"
                        className="formspec-wizard-skip"
                        onClick={handleSkip}
                        aria-label="Skip this step"
                    >
                        Skip
                    </button>
                )}

                {!isLast ? (
                    <button
                        type="button"
                        className="formspec-wizard-next"
                        onClick={handleNext}
                        aria-label="Next step"
                    >
                        Next
                    </button>
                ) : (
                    <button
                        type="button"
                        className="formspec-wizard-submit"
                        aria-label="Submit form"
                        onClick={() => {
                            touchCurrentStep();
                            if (currentStepHasErrors()) return;
                            if (onSubmit) {
                                const response = engine.getResponse({ mode: 'submit' });
                                const validationReport = engine.getValidationReport({ mode: 'submit' });
                                onSubmit({ response, validationReport });
                            }
                        }}
                    >
                        Submit
                    </button>
                )}
            </div>
        </div>
    );
}
