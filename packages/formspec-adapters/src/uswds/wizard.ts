/** @filedesc USWDS v3 adapter for page-mode wizard rendering (formPresentation.pageMode: "wizard").
 *
 * This file styles the wizard UI synthesized by emit-node.ts when a Stack root
 * has Page children and formPresentation.pageMode is "wizard". The "Wizard"
 * adapter key is a rendering concept — the Wizard schema component type was
 * removed; all page navigation is now driven by formPresentation. */
import type { WizardBehavior, AdapterRenderFn } from 'formspec-webcomponent';

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

    // Step indicator (USWDS)
    let stepIndicator: HTMLElement | undefined;
    let segmentsList: HTMLOListElement | undefined;
    let currentStepSpan: HTMLElement | undefined;
    let totalStepsSpan: HTMLElement | undefined;
    let headingText: HTMLElement | undefined;

    if (behavior.showProgress) {
        stepIndicator = document.createElement('div');
        stepIndicator.className = 'usa-step-indicator';
        stepIndicator.setAttribute('aria-label', 'progress');

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
        root.appendChild(stepIndicator);
    }

    // Step panels
    const panels: HTMLElement[] = [];
    for (let i = 0; i < behavior.totalSteps(); i++) {
        const panel = document.createElement('div');
        panel.className = 'formspec-wizard-panel';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', behavior.steps[i]?.title || `Step ${i + 1}`);
        if (i !== 0) panel.classList.add('formspec-hidden');
        behavior.renderStep(i, panel);
        root.appendChild(panel);
        panels.push(panel);
    }

    // Navigation buttons
    const nav = document.createElement('div');
    nav.className = 'formspec-wizard-nav';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'usa-button usa-button--outline';
    prevBtn.textContent = 'Previous';
    nav.appendChild(prevBtn);

    if (behavior.allowSkip) {
        const skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'usa-button usa-button--unstyled';
        skipBtn.textContent = 'Skip';
        skipBtn.addEventListener('click', () => {
            if (behavior.canGoNext()) behavior.goToStep(behavior.activeStep() + 1);
        });
        nav.appendChild(skipBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'usa-button';
    nextBtn.textContent = 'Next';
    nav.appendChild(nextBtn);

    root.appendChild(nav);

    // Update step indicator reactively via bind()
    // We build segments once per render — bind() handles active step updates
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

    const dispose = behavior.bind({
        root,
        panels,
        stepIndicators,
        stepContent: root,
        prevButton: prevBtn,
        nextButton: nextBtn,
    });
    actx.onDispose(dispose);

    // Step indicator class updates — listen for step changes via a MutationObserver
    // on panel visibility, or use a simpler approach: patch after bind sets up effects.
    // Since bind() manages panel visibility and button state, we piggyback on panel
    // visibility to update the USWDS step indicator classes.
    if (segmentsList && stepIndicators) {
        const updateIndicator = () => {
            const activeIdx = panels.findIndex(p => !p.classList.contains('formspec-hidden'));
            if (activeIdx < 0) return;

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
                    // Add sr-only completed text
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
            if (currentStepSpan) currentStepSpan.textContent = String(activeIdx + 1);
            if (headingText) {
                headingText.textContent = behavior.steps[activeIdx]?.title || `Step ${activeIdx + 1}`;
            }
        };

        // Use MutationObserver on panels to detect visibility changes driven by bind()
        const observer = new MutationObserver(updateIndicator);
        for (const panel of panels) {
            observer.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
        }
        actx.onDispose(() => observer.disconnect());
        // Initial update
        updateIndicator();
    }
};
