/** @filedesc USWDS v3 adapter for page-mode wizard rendering (formPresentation.pageMode: "wizard").
 *
 * This file styles the wizard UI synthesized by emit-node.ts when a Stack root
 * has Page children and formPresentation.pageMode is "wizard". The "Wizard"
 * adapter key is a rendering concept — the Wizard schema component type was
 * removed; all page navigation is now driven by formPresentation. */
import type { WizardBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';

export const renderWizard: AdapterRenderFn<WizardBehavior> = (
    behavior, parent, actx
) => {
    const root = document.createElement('div');
    if (behavior.id) root.id = behavior.id;
    root.className = 'formspec-wizard';
    if (behavior.compOverrides.cssClass) actx.applyCssClass(root, behavior.compOverrides);
    if (behavior.compOverrides.accessibility) actx.applyAccessibility(root, behavior.compOverrides);
    if (behavior.compOverrides.style) actx.applyStyle(root, behavior.compOverrides.style);
    parent.appendChild(root);

    if (behavior.totalSteps() === 0) return;

    const stepContent = document.createElement('div');
    stepContent.className = 'formspec-uswds-wizard__content';
    root.appendChild(stepContent);

    let stepIndicator: HTMLElement | undefined;
    let segmentsList: HTMLOListElement | undefined;
    let currentStepSpan: HTMLElement | undefined;
    let totalStepsSpan: HTMLElement | undefined;
    let headingText: HTMLElement | undefined;
    let skipBtn: HTMLButtonElement | undefined;

    if (behavior.showProgress) {
        stepIndicator = document.createElement('nav');
        stepIndicator.className = 'usa-step-indicator';
        stepIndicator.setAttribute('aria-label', 'Form progress');

        segmentsList = document.createElement('ol');
        segmentsList.className = 'usa-step-indicator__segments';
        stepIndicator.appendChild(segmentsList);

        const header = document.createElement('div');
        header.className = 'usa-step-indicator__header';

        const heading = document.createElement('h4');
        heading.className = 'usa-step-indicator__heading';

        const counter = document.createElement('span');
        counter.className = 'usa-step-indicator__heading-counter';

        const srStep = document.createElement('span');
        srStep.className = 'usa-sr-only';
        srStep.textContent = 'Step';
        counter.appendChild(srStep);

        currentStepSpan = document.createElement('span');
        currentStepSpan.className = 'usa-step-indicator__current-step';
        counter.appendChild(currentStepSpan);

        totalStepsSpan = document.createElement('span');
        totalStepsSpan.className = 'usa-step-indicator__total-steps';
        counter.appendChild(totalStepsSpan);

        heading.appendChild(counter);

        headingText = document.createElement('span');
        headingText.className = 'usa-step-indicator__heading-text';
        heading.appendChild(headingText);

        header.appendChild(heading);
        stepIndicator.appendChild(header);
        stepContent.appendChild(stepIndicator);
    }

    const panels: HTMLElement[] = [];
    for (let i = 0; i < behavior.totalSteps(); i++) {
        const panel = document.createElement('div');
        panel.className = 'formspec-wizard-panel';
        panel.setAttribute('role', 'region');
        panel.tabIndex = -1;
        const panelLabelId = `${behavior.id || 'formspec-wizard'}-step-${i + 1}-label`;
        panel.setAttribute('aria-labelledby', panelLabelId);
        if (i !== 0) panel.classList.add('formspec-hidden');

        const panelHeading = document.createElement('h2');
        panelHeading.id = panelLabelId;
        panelHeading.className = 'usa-step-indicator__heading formspec-uswds-wizard__panel-heading';
        panelHeading.textContent = behavior.steps[i]?.title || `Step ${i + 1}`;
        panel.appendChild(panelHeading);

        behavior.renderStep(i, panel);
        stepContent.appendChild(panel);
        panels.push(panel);
    }

    const nav = document.createElement('div');
    nav.className = 'formspec-wizard-nav usa-button-group';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'formspec-wizard-prev usa-button usa-button--outline';
    prevBtn.textContent = 'Previous';
    nav.appendChild(prevBtn);

    if (behavior.allowSkip) {
        skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'formspec-wizard-skip usa-button usa-button--unstyled';
        skipBtn.textContent = 'Skip';
        skipBtn.addEventListener('click', () => {
            if (behavior.canGoNext()) behavior.goToStep(behavior.activeStep() + 1);
        });
        nav.appendChild(skipBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'formspec-wizard-next usa-button';
    nextBtn.textContent = 'Next';
    nav.appendChild(nextBtn);

    stepContent.appendChild(nav);

    const announcer = document.createElement('div');
    announcer.className = 'usa-sr-only';
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('role', 'status');
    stepContent.appendChild(announcer);

    if (segmentsList) {
        for (let i = 0; i < behavior.totalSteps(); i++) {
            const segment = document.createElement('li');
            segment.className = 'usa-step-indicator__segment';

            const segLabel = document.createElement('span');
            segLabel.className = 'usa-step-indicator__segment-label';
            segLabel.textContent = behavior.steps[i]?.title || `Step ${i + 1}`;
            segment.appendChild(segLabel);

            segmentsList.appendChild(segment);
        }
        if (currentStepSpan) currentStepSpan.textContent = '1';
        if (totalStepsSpan) totalStepsSpan.textContent = ` of ${behavior.totalSteps()}`;
        if (headingText) headingText.textContent = behavior.steps[0]?.title || 'Step 1';
    }

    // Collect step indicator elements for bind() to update
    const stepIndicators = segmentsList
        ? Array.from(segmentsList.children) as HTMLElement[]
        : undefined;

    const updateIndicator = (activeIdx: number) => {
        if (activeIdx < 0) return;

        if (stepIndicators) {
            for (let i = 0; i < stepIndicators.length; i++) {
                const seg = stepIndicators[i];
                seg.classList.remove(
                    'usa-step-indicator__segment--current',
                    'usa-step-indicator__segment--complete'
                );
                if (i === activeIdx) {
                    seg.classList.add('usa-step-indicator__segment--current');
                } else if (i < activeIdx) {
                    seg.classList.add('usa-step-indicator__segment--complete');
                    const label = seg.querySelector('.usa-step-indicator__segment-label');
                    if (label && !label.querySelector('.usa-sr-only')) {
                        const sr = document.createElement('span');
                        sr.className = 'usa-sr-only';
                        sr.textContent = 'completed';
                        label.appendChild(sr);
                    }
                } else {
                    // Future steps — remove any stale sr-only completed text
                    const sr = seg.querySelector('.usa-sr-only');
                    if (sr) sr.remove();
                }
            }
        }
        if (currentStepSpan) currentStepSpan.textContent = String(activeIdx + 1);
        if (headingText) {
            headingText.textContent = behavior.steps[activeIdx]?.title || `Step ${activeIdx + 1}`;
        }
    };

    const dispose = behavior.bind({
        root,
        panels,
        stepIndicators,
        stepContent,
        prevButton: prevBtn,
        nextButton: nextBtn,
        skipButton: skipBtn,
        onStepChange: (stepIndex) => updateIndicator(stepIndex),
    });
    actx.onDispose(dispose);
};
