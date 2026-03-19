/** @filedesc Tabs behavior hook — manages tabbed interface state. */
import { signal } from '@preact/signals-core';
import { effect } from '@preact/signals-core';
import type { TabsBehavior, TabsRefs, BehaviorContext } from './types';

export function useTabs(ctx: BehaviorContext, comp: any): TabsBehavior {
    const children: any[] = comp.children || [];
    const tabLabels: string[] = comp.tabLabels || [];
    const position: 'top' | 'bottom' = comp.position || 'top';
    const defaultTab = comp.defaultTab || 0;
    const activeTabSignal = signal(defaultTab);

    const setActiveTab = (nextTab: number) => {
        const bounded = Math.max(0, Math.min(children.length - 1, Math.trunc(nextTab)));
        activeTabSignal.value = bounded;
    };

    return {
        id: comp.id,
        compOverrides: {
            cssClass: comp.cssClass,
            style: comp.style,
            accessibility: comp.accessibility,
        },
        tabLabels,
        tabCount: children.length,
        position,
        defaultTab,

        activeTab(): number {
            return activeTabSignal.value;
        },

        setActiveTab,

        renderTab(index: number, parent: HTMLElement): void {
            ctx.renderComponent(children[index], parent, ctx.prefix);
        },

        bind(refs: TabsRefs): () => void {
            const disposers: Array<() => void> = [];

            // Reactive panel/button toggling
            disposers.push(effect(() => {
                const active = activeTabSignal.value;
                refs.panels.forEach((p, idx) => p.classList.toggle('formspec-hidden', idx !== active));
                refs.buttons.forEach((b, idx) => b.classList.toggle('formspec-tab--active', idx === active));
            }));

            // Wire button clicks
            refs.buttons.forEach((btn, i) => {
                btn.addEventListener('click', () => setActiveTab(i));
            });

            // formspec-tabs-set-active custom event
            const onSetActive = (event: Event) => {
                const customEvent = event as CustomEvent<{ index?: unknown }>;
                const requestedIndex = Number(customEvent.detail?.index);
                if (!Number.isFinite(requestedIndex)) return;
                setActiveTab(requestedIndex);
                event.stopPropagation();
            };
            refs.root.addEventListener('formspec-tabs-set-active', onSetActive as EventListener);
            disposers.push(() => {
                refs.root.removeEventListener('formspec-tabs-set-active', onSetActive as EventListener);
            });

            return () => disposers.forEach(d => d());
        },
    };
}
