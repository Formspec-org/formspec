/** @filedesc USWDS Columns layout — `grid-row` / `grid-col-*`; custom `widths` falls back to default CSS grid. */
import type { AdapterContext, ColumnsLayoutBehavior } from '@formspec-org/webcomponent';
import { renderDefaultLayoutColumns } from '@formspec-org/webcomponent';
import { equalGridCellClass, USWDS_LAYOUT_ROW_CLASS, renderUSWDSLayoutHeader } from './grid-shared';

/**
 * Renders USWDS `grid-row` / `grid-col-*` for equal `columnCount`. Arbitrary width templates delegate to {@link renderDefaultLayoutColumns}.
 */
export function renderUSWDSColumns(behavior: ColumnsLayoutBehavior, parent: HTMLElement, actx: AdapterContext): void {
    const { comp, host, titleText, descriptionText } = behavior;
    if (Array.isArray(comp.widths) && comp.widths.length > 0) {
        renderDefaultLayoutColumns(behavior, parent, actx);
        return;
    }

    const n = typeof comp.columnCount === 'number' ? comp.columnCount : 2;
    const colClass = equalGridCellClass(n);

    const row = document.createElement('div');
    if (comp.id) row.id = comp.id;
    row.className = USWDS_LAYOUT_ROW_CLASS;
    if (comp.gap) row.style.gap = String(host.resolveToken(comp.gap));

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
