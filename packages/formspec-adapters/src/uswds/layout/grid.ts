/** @filedesc USWDS layout grid — `grid-row` / `grid-col-*` with optional token gaps; string `columns` falls back to default CSS grid. */
import type { AdapterContext, GridLayoutBehavior } from '@formspec-org/webcomponent';
import { renderDefaultLayoutGrid } from '@formspec-org/webcomponent';
import { equalGridCellClass, USWDS_LAYOUT_ROW_CLASS, renderUSWDSLayoutHeader } from './grid-shared';

/**
 * Renders a USWDS flex row with responsive columns. Custom `columns` template strings delegate to {@link renderDefaultLayoutGrid}.
 */
export function renderUSWDSGrid(behavior: GridLayoutBehavior, parent: HTMLElement, actx: AdapterContext): void {
    const { comp, host, titleText, descriptionText } = behavior;
    if (typeof comp.columns === 'string') {
        renderDefaultLayoutGrid(behavior, parent, actx);
        return;
    }

    const n = typeof comp.columns === 'number' ? comp.columns : 2;
    const colClass = equalGridCellClass(n);

    const row = document.createElement('div');
    if (comp.id) row.id = comp.id;
    row.className = USWDS_LAYOUT_ROW_CLASS;
    if (comp.gap) row.style.gap = String(host.resolveToken(comp.gap));
    if (comp.rowGap) row.style.rowGap = String(host.resolveToken(comp.rowGap));

    actx.applyCssClass(row, comp);
    actx.applyAccessibility(row, comp);
    actx.applyStyle(row, comp.style);

    renderUSWDSLayoutHeader(row, titleText, descriptionText);

    for (const child of comp.children || []) {
        const cell = document.createElement('div');
        cell.className = colClass;
        host.renderComponent(child, cell, host.prefix);
        row.appendChild(cell);
    }
    parent.appendChild(row);
}
