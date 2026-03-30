/** @filedesc Shared USWDS 12-column row helpers for Grid and Columns layout adapters (tablet col span classes). */

/** Equal column counts that map cleanly to USWDS’s 12-column row (12 % n === 0). */
export const USWDS_EQUAL_COL_COUNTS = new Set([1, 2, 3, 4, 6]);

export function tabletColClass(n: number): string {
    const span = 12 / n;
    return `tablet:grid-col-${span}`;
}

/** USWDS layout row only (`usa-layout-grid`); integration SCSS targets `.grid-row.grid-gap` without a Formspec bridge class. */
export const USWDS_LAYOUT_ROW_CLASS = 'grid-row grid-gap';

/**
 * Full-width on small screens; on tablet+, equal columns — either explicit 12/n spans or `grid-col-fill` for other counts.
 */
export function equalGridCellClass(columnCount: number): string {
    const n = Math.max(1, Math.floor(columnCount));
    if (USWDS_EQUAL_COL_COUNTS.has(n)) {
        return `grid-col-12 ${tabletColClass(n)}`;
    }
    return 'grid-col-12 tablet:grid-col-fill';
}

/** Internal helper to render standard USWDS layout title/description headers. */
export function renderUSWDSLayoutHeader(el: HTMLElement, titleText: string | null, descriptionText: string | null): void {
    if (titleText) {
        const h = document.createElement('h3');
        h.className = 'formspec-layout-title';
        h.textContent = titleText;
        el.appendChild(h);
    }
    if (descriptionText) {
        const p = document.createElement('p');
        p.className = 'usa-hint formspec-layout-description';
        p.textContent = descriptionText;
        el.appendChild(p);
    }
}
