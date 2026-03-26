/** @filedesc Tailwind adapter for page-mode wizard rendering (formPresentation.pageMode: "wizard").
 *
 * This file styles the wizard UI synthesized by emit-node.ts when a Stack root
 * has Page children and formPresentation.pageMode is "wizard". The "Wizard"
 * adapter key is a rendering concept — the Wizard schema component type was
 * removed; all page navigation is now driven by formPresentation. */
import type { WizardBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { TW } from './shared';

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

    // Step indicator
    let stepIndicator: HTMLElement | undefined;
    let stepElements: HTMLElement[] | undefined;

    if (behavior.showProgress) {
        stepIndicator = document.createElement('nav');
        stepIndicator.className = 'mb-8';
        stepIndicator.setAttribute('aria-label', 'progress');

        const stepList = document.createElement('ol');
        stepList.className = 'flex items-center';

        stepElements = [];
        for (let i = 0; i < behavior.totalSteps(); i++) {
            const li = document.createElement('li');
            li.className = i < behavior.totalSteps() - 1
                ? 'relative flex-1 pr-8'
                : 'relative';

            const stepContent = document.createElement('div');
            stepContent.className = 'flex items-center';

            const circle = document.createElement('span');
            circle.className = 'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium';
            if (i === 0) {
                circle.style.backgroundColor = 'var(--formspec-tw-accent)';
                circle.style.color = 'var(--formspec-tw-accent-fg)';
            } else {
                circle.style.borderWidth = '2px';
                circle.style.borderStyle = 'solid';
                circle.style.borderColor = 'var(--formspec-tw-border)';
                circle.style.color = 'var(--formspec-tw-muted)';
            }
            circle.textContent = String(i + 1);
            stepContent.appendChild(circle);

            const stepLabel = document.createElement('span');
            stepLabel.className = 'ml-2 text-sm font-medium text-[var(--formspec-tw-text)]';
            stepLabel.textContent = behavior.steps[i]?.title || `Step ${i + 1}`;
            stepContent.appendChild(stepLabel);

            li.appendChild(stepContent);

            // Connector line between steps
            if (i < behavior.totalSteps() - 1) {
                const connector = document.createElement('div');
                connector.className = 'absolute right-0 top-4 h-0.5 w-full bg-[var(--formspec-tw-border)]';
                connector.style.left = '2rem';
                connector.style.right = '0';
                li.appendChild(connector);
            }

            stepList.appendChild(li);
            stepElements.push(li);
        }

        stepIndicator.appendChild(stepList);
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
    nav.className = 'formspec-wizard-nav flex justify-between mt-6';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = TW.buttonOutline;
    prevBtn.textContent = 'Previous';
    nav.appendChild(prevBtn);

    if (behavior.allowSkip) {
        const skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = TW.buttonUnstyled;
        skipBtn.textContent = 'Skip';
        skipBtn.addEventListener('click', () => {
            if (behavior.canGoNext()) behavior.goToStep(behavior.activeStep() + 1);
        });
        nav.appendChild(skipBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = TW.button;
    nextBtn.textContent = 'Next';
    nav.appendChild(nextBtn);

    root.appendChild(nav);

    const dispose = behavior.bind({
        root,
        panels,
        stepIndicators: stepElements,
        stepContent: root,
        prevButton: prevBtn,
        nextButton: nextBtn,
    });
    actx.onDispose(dispose);

    // Update step indicator on panel visibility changes
    if (stepElements) {
        const updateIndicator = () => {
            const activeIdx = panels.findIndex(p => !p.classList.contains('formspec-hidden'));
            if (activeIdx < 0) return;

            for (let i = 0; i < stepElements!.length; i++) {
                const circle = stepElements![i].querySelector('span')!;
                circle.className = 'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium';
                // Reset inline styles
                circle.style.backgroundColor = '';
                circle.style.color = '';
                circle.style.borderWidth = '';
                circle.style.borderStyle = '';
                circle.style.borderColor = '';
                if (i === activeIdx) {
                    circle.style.backgroundColor = 'var(--formspec-tw-accent)';
                    circle.style.color = 'var(--formspec-tw-accent-fg)';
                } else if (i < activeIdx) {
                    circle.style.backgroundColor = 'var(--formspec-tw-success)';
                    circle.style.color = 'var(--formspec-tw-accent-fg)';
                } else {
                    circle.style.borderWidth = '2px';
                    circle.style.borderStyle = 'solid';
                    circle.style.borderColor = 'var(--formspec-tw-border)';
                    circle.style.color = 'var(--formspec-tw-muted)';
                }
            }
        };

        const observer = new MutationObserver(updateIndicator);
        for (const panel of panels) {
            observer.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
        }
        actx.onDispose(() => observer.disconnect());
        updateIndicator();
    }
};
