/** @filedesc Tailwind adapter for Tabs — styled tab bar with panel switching. */
import type { TabsBehavior, AdapterRenderFn } from 'formspec-webcomponent';

export const renderTabs: AdapterRenderFn<TabsBehavior> = (
    behavior, parent, actx
) => {
    const root = document.createElement('div');
    if (behavior.id) root.id = behavior.id;
    root.className = 'formspec-tabs';
    if (behavior.position !== 'top') root.dataset.position = behavior.position;
    if (behavior.compOverrides.cssClass) actx.applyCssClass(root, behavior.compOverrides);
    if (behavior.compOverrides.accessibility) actx.applyAccessibility(root, behavior.compOverrides);
    if (behavior.compOverrides.style) actx.applyStyle(root, behavior.compOverrides.style);
    parent.appendChild(root);

    const count = behavior.tabCount;
    const idBase = behavior.id || 'tabs';

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'border-b border-gray-200';

    const tabList = document.createElement('nav');
    tabList.className = 'flex -mb-px space-x-4';
    tabList.setAttribute('role', 'tablist');
    tabBar.appendChild(tabList);

    // Tab panels
    const panelContainer = document.createElement('div');
    panelContainer.className = 'formspec-tab-panels mt-4';

    const panels: HTMLElement[] = [];
    for (let i = 0; i < count; i++) {
        const panel = document.createElement('div');
        panel.className = 'formspec-tab-panel';
        panel.setAttribute('role', 'tabpanel');
        panel.id = `${idBase}-panel-${i}`;
        panel.setAttribute('aria-labelledby', `${idBase}-tab-${i}`);
        panel.setAttribute('tabindex', '0');
        if (i !== behavior.defaultTab) panel.style.display = 'none';
        behavior.renderTab(i, panel);
        panelContainer.appendChild(panel);
        panels.push(panel);
    }

    // Tab buttons
    const buttons: HTMLButtonElement[] = [];
    for (let i = 0; i < count; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'tab');
        btn.id = `${idBase}-tab-${i}`;
        btn.setAttribute('aria-controls', `${idBase}-panel-${i}`);
        btn.setAttribute('aria-selected', i === behavior.defaultTab ? 'true' : 'false');
        btn.setAttribute('tabindex', i === behavior.defaultTab ? '0' : '-1');
        btn.textContent = behavior.tabLabels[i] || `Tab ${i + 1}`;
        btn.className = i === behavior.defaultTab
            ? 'border-b-2 border-blue-500 px-3 py-2 text-sm font-medium text-blue-600'
            : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700';

        tabList.appendChild(btn);
        buttons.push(btn);
    }

    // Position: bottom puts panels before bar
    if (behavior.position === 'bottom') {
        root.appendChild(panelContainer);
        root.appendChild(tabBar);
    } else {
        root.appendChild(tabBar);
        root.appendChild(panelContainer);
    }

    const dispose = behavior.bind({ root, tabBar: tabList, panels, buttons });
    actx.onDispose(dispose);

    // Sync Tailwind tab styling with active state
    const updateButtonStyles = () => {
        for (let i = 0; i < buttons.length; i++) {
            const isActive = buttons[i].getAttribute('aria-selected') === 'true';
            buttons[i].className = isActive
                ? 'border-b-2 border-blue-500 px-3 py-2 text-sm font-medium text-blue-600'
                : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700';
        }
    };
    const observer = new MutationObserver(updateButtonStyles);
    for (const btn of buttons) {
        observer.observe(btn, { attributes: true, attributeFilter: ['aria-selected'] });
    }
    actx.onDispose(() => observer.disconnect());
};
