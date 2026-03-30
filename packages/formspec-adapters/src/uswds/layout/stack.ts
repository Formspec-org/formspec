/** @filedesc USWDS Stack layout — vertical stack as full-width row cells; horizontal as auto-width cells on tablet+. */
import type { AdapterContext, StackLayoutBehavior } from '@formspec-org/webcomponent';
import { USWDS_LAYOUT_ROW_CLASS, renderUSWDSLayoutHeader } from './grid-shared';

export function renderUSWDSStack(behavior: StackLayoutBehavior, parent: HTMLElement, actx: AdapterContext): void {
    const { comp, host, titleText, descriptionText } = behavior;
    const row = document.createElement('div');
    if (comp.id) row.id = comp.id;
    const horizontal = comp.direction === 'horizontal';
    row.className = [
        'formspec-stack',
        USWDS_LAYOUT_ROW_CLASS,
        horizontal ? 'formspec-stack--horizontal' : '',
        comp.wrap ? 'formspec-stack--wrap' : '',
    ]
        .filter(Boolean)
        .join(' ');
    if (comp.align) row.dataset.align = comp.align;
    if (comp.gap) row.style.gap = String(host.resolveToken(comp.gap));

    actx.applyCssClass(row, comp);
    actx.applyAccessibility(row, comp);
    actx.applyStyle(row, comp.style);

    renderUSWDSLayoutHeader(row, titleText, descriptionText);

    const cellClass = horizontal ? 'grid-col-12 tablet:grid-col-auto' : 'grid-col-12';

    for (const child of comp.children || []) {
        const cell = document.createElement('div');
        cell.className = cellClass;
        host.renderComponent(child, cell, host.prefix);
        row.appendChild(cell);
    }

    parent.appendChild(row);
}
