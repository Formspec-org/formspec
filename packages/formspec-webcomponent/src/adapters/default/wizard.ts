/** @filedesc Default adapter for Wizard — reproduces current DOM structure. */
import { signal } from '@preact/signals-core';
import { effect } from '@preact/signals-core';
import type { WizardBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';

export const renderWizard: AdapterRenderFn<WizardBehavior> = (
    behavior, parent, actx
) => {
    const el = document.createElement('div');
    if (behavior.id) el.id = behavior.id;
    el.className = 'formspec-wizard';
    if (behavior.compOverrides.cssClass) actx.applyCssClass(el, behavior.compOverrides);
    if (behavior.compOverrides.accessibility) actx.applyAccessibility(el, behavior.compOverrides);
    if (behavior.compOverrides.style) actx.applyStyle(el, behavior.compOverrides.style);
    parent.appendChild(el);

    if (behavior.totalSteps() === 0) return;

    const showSideNav = behavior.showSideNav;
    let container: HTMLElement = el;

    if (showSideNav) {
        el.classList.add('formspec-wizard--with-sidenav');
        const collapsed = signal(false);

        // Side nav
        const sidenav = document.createElement('nav');
        sidenav.className = 'formspec-wizard-sidenav';
        sidenav.setAttribute('aria-label', 'Form steps');
        el.appendChild(sidenav);

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'formspec-wizard-sidenav-toggle';
        sidenav.appendChild(toggleBtn);

        const stepList = document.createElement('ol');
        stepList.className = 'formspec-wizard-sidenav-list';
        sidenav.appendChild(stepList);

        // Collapse/expand toggle
        actx.onDispose(effect(() => {
            const isCollapsed = collapsed.value;
            sidenav.classList.toggle('formspec-wizard-sidenav--collapsed', isCollapsed);
            toggleBtn.setAttribute('aria-label', isCollapsed ? 'Expand navigation' : 'Collapse navigation');
            toggleBtn.title = isCollapsed ? 'Expand' : 'Collapse';
            toggleBtn.innerHTML = isCollapsed
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>';
        }));
        toggleBtn.addEventListener('click', () => { collapsed.value = !collapsed.value; });

        // Step list items — rebuilt on step change
        actx.onDispose(effect(() => {
            const step = behavior.activeStep();
            stepList.innerHTML = '';
            for (let i = 0; i < behavior.totalSteps(); i++) {
                const item = document.createElement('li');
                item.className = 'formspec-wizard-sidenav-item';
                if (i === step) item.classList.add('formspec-wizard-sidenav-item--active');
                if (i < step) item.classList.add('formspec-wizard-sidenav-item--completed');
                item.setAttribute('role', 'button');
                item.tabIndex = 0;
                item.setAttribute('aria-current', i === step ? 'step' : 'false');

                const circle = document.createElement('span');
                circle.className = 'formspec-wizard-sidenav-step';
                circle.textContent = i < step ? '\u2713' : String(i + 1);
                item.appendChild(circle);

                const label = document.createElement('span');
                label.className = 'formspec-wizard-sidenav-label';
                label.textContent = behavior.steps[i]?.title || `Step ${i + 1}`;
                item.appendChild(label);

                const idx = i;
                item.addEventListener('click', () => behavior.goToStep(idx));
                item.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); behavior.goToStep(idx); }
                });

                stepList.appendChild(item);
            }
        }));

        // Content area
        const content = document.createElement('div');
        content.className = 'formspec-wizard-content';
        el.appendChild(content);
        container = content;
    }

    // Progress bar (always in DOM when showProgress, hidden when sidenav shown)
    if (behavior.showProgress) {
        const progress = document.createElement('div');
        progress.className = 'formspec-wizard-steps';
        progress.classList.toggle('formspec-hidden', showSideNav);
        container.appendChild(progress);

        actx.onDispose(effect(() => {
            const step = behavior.activeStep();
            progress.innerHTML = '';
            for (let i = 0; i < behavior.totalSteps(); i++) {
                const wrapper = document.createElement('div');
                wrapper.className = 'formspec-wizard-step-wrapper';

                const indicator = document.createElement('span');
                indicator.className = 'formspec-wizard-step';
                if (i === step) indicator.classList.add('formspec-wizard-step--active');
                if (i < step) indicator.classList.add('formspec-wizard-step--completed');
                indicator.textContent = `${i + 1}`;
                wrapper.appendChild(indicator);

                const stepTitle = behavior.steps[i]?.title;
                if (stepTitle) {
                    const label = document.createElement('span');
                    label.className = 'formspec-wizard-step-label';
                    if (i === step) label.classList.add('formspec-wizard-step-label--active');
                    label.textContent = stepTitle;
                    wrapper.appendChild(label);
                }

                progress.appendChild(wrapper);
            }
        }));
    }

    // Step panels
    const panels: HTMLElement[] = [];
    for (let i = 0; i < behavior.totalSteps(); i++) {
        const panel = document.createElement('div');
        panel.className = 'formspec-wizard-panel';
        if (i !== 0) panel.classList.add('formspec-hidden');
        behavior.renderStep(i, panel);
        container.appendChild(panel);
        panels.push(panel);
    }

    // Reactively show/hide panels
    actx.onDispose(effect(() => {
        const step = behavior.activeStep();
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
    nav.appendChild(prevBtn);

    if (behavior.allowSkip) {
        const skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'formspec-wizard-skip';
        skipBtn.textContent = 'Skip';
        skipBtn.addEventListener('click', () => {
            if (behavior.canGoNext()) behavior.goToStep(behavior.activeStep() + 1);
        });
        nav.appendChild(skipBtn);

        // Hide skip on last step
        actx.onDispose(effect(() => {
            const step = behavior.activeStep();
            skipBtn.classList.toggle('formspec-hidden', step === behavior.totalSteps() - 1);
        }));
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'formspec-wizard-next';
    nextBtn.textContent = 'Next';
    nav.appendChild(nextBtn);
    container.appendChild(nav);

    // Bind behavior to refs
    const dispose = behavior.bind({
        root: el,
        prevButton: prevBtn,
        nextButton: nextBtn,
        stepContent: container,
    });
    actx.onDispose(dispose);
};
