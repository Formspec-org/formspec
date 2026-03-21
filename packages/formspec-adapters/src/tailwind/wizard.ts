/** @filedesc Tailwind adapter for Wizard — step progress with styled navigation buttons. */
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
            circle.className = i === 0
                ? 'flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white'
                : 'flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 text-sm font-medium text-gray-500';
            circle.textContent = String(i + 1);
            stepContent.appendChild(circle);

            const stepLabel = document.createElement('span');
            stepLabel.className = 'ml-2 text-sm font-medium text-gray-700';
            stepLabel.textContent = behavior.steps[i]?.title || `Step ${i + 1}`;
            stepContent.appendChild(stepLabel);

            li.appendChild(stepContent);

            // Connector line between steps
            if (i < behavior.totalSteps() - 1) {
                const connector = document.createElement('div');
                connector.className = 'absolute right-0 top-4 h-0.5 w-full bg-gray-200';
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
                if (i === activeIdx) {
                    circle.className = 'flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white';
                } else if (i < activeIdx) {
                    circle.className = 'flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-sm font-medium text-white';
                } else {
                    circle.className = 'flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 text-sm font-medium text-gray-500';
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
