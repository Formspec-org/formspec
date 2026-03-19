/** @filedesc Default adapter for Tabs — reproduces current DOM structure. */
import type { TabsBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';

export const renderTabs: AdapterRenderFn<TabsBehavior> = (
    behavior, parent, actx
) => {
    const el = document.createElement('div');
    if (behavior.id) el.id = behavior.id;
    el.className = 'formspec-tabs';
    if (behavior.position !== 'top') el.dataset.position = behavior.position;
    if (behavior.compOverrides.cssClass) actx.applyCssClass(el, behavior.compOverrides);
    if (behavior.compOverrides.accessibility) actx.applyAccessibility(el, behavior.compOverrides);
    if (behavior.compOverrides.style) actx.applyStyle(el, behavior.compOverrides.style);
    parent.appendChild(el);

    const count = behavior.tabCount;

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'formspec-tab-bar';

    // Panel container
    const panelContainer = document.createElement('div');
    panelContainer.className = 'formspec-tab-panels';

    // Tab panels
    const panels: HTMLElement[] = [];
    for (let i = 0; i < count; i++) {
        const panel = document.createElement('div');
        panel.className = 'formspec-tab-panel';
        if (i !== behavior.defaultTab) panel.classList.add('formspec-hidden');
        behavior.renderTab(i, panel);
        panelContainer.appendChild(panel);
        panels.push(panel);
    }

    // Tab buttons
    const buttons: HTMLButtonElement[] = [];
    for (let i = 0; i < count; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = behavior.tabLabels[i] || `Tab ${i + 1}`;
        btn.className = 'formspec-tab';
        tabBar.appendChild(btn);
        buttons.push(btn);
    }

    // Position: bottom puts panels before bar
    if (behavior.position === 'bottom') {
        el.appendChild(panelContainer);
        el.appendChild(tabBar);
    } else {
        el.appendChild(tabBar);
        el.appendChild(panelContainer);
    }

    // Bind behavior
    const dispose = behavior.bind({
        root: el,
        tabBar,
        panels,
        buttons,
    });
    actx.onDispose(dispose);
};
