import { signal } from '@preact/signals-core';
import { effect } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';

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

        // Progress indicator
        if (comp.showProgress !== false) {
            const progress = document.createElement('div');
            progress.className = 'formspec-wizard-steps';
            el.appendChild(progress);

            ctx.cleanupFns.push(effect(() => {
                const step = currentStep.value;
                progress.innerHTML = '';
                for (let i = 0; i < children.length; i++) {
                    const indicator = document.createElement('span');
                    indicator.className = 'formspec-wizard-step';
                    if (i === step) indicator.classList.add('formspec-wizard-step--active');
                    if (i < step) indicator.classList.add('formspec-wizard-step--completed');
                    indicator.textContent = `${i + 1}`;
                    progress.appendChild(indicator);
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
            if (currentStep.value > 0) currentStep.value = currentStep.value - 1;
        });

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'formspec-wizard-next';
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', () => {
            if (currentStep.value < children.length - 1) currentStep.value = currentStep.value + 1;
        });

        nav.appendChild(prevBtn);

        if (comp.allowSkip) {
            const skipBtn = document.createElement('button');
            skipBtn.type = 'button';
            skipBtn.className = 'formspec-wizard-skip';
            skipBtn.textContent = 'Skip';
            skipBtn.addEventListener('click', () => {
                if (currentStep.value < children.length - 1) currentStep.value = currentStep.value + 1;
            });
            nav.appendChild(skipBtn);
        }

        nav.appendChild(nextBtn);
        el.appendChild(nav);

        // Reactively enable/disable prev/next
        ctx.cleanupFns.push(effect(() => {
            const step = currentStep.value;
            prevBtn.disabled = step === 0;
            nextBtn.disabled = step === children.length - 1;
            prevBtn.classList.toggle('formspec-hidden', step === 0);
            nextBtn.textContent = step === children.length - 1 ? 'Finish' : 'Next';
        }));
    }
};

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
            if (i === defaultTab) btn.classList.add('formspec-tab--active');
            btn.addEventListener('click', () => {
                panels.forEach((p, idx) => p.classList.toggle('formspec-hidden', idx !== i));
                buttons.forEach((b, idx) => b.classList.toggle('formspec-tab--active', idx === i));
            });
            tabBar.appendChild(btn);
            buttons.push(btn);
        }

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
