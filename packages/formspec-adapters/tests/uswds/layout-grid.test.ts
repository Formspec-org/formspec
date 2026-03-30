/** @filedesc USWDS adapter layout — Grid/Columns USWDS row markup vs default fallback. */
import { describe, it, expect, vi } from 'vitest';
import type { ColumnsLayoutBehavior, GridLayoutBehavior } from '@formspec-org/webcomponent';
import { renderUSWDSGrid } from '../../src/uswds/layout/grid';
import { renderUSWDSColumns } from '../../src/uswds/layout/columns';
import { mockAdapterContext } from '../helpers';

function mockHost(): GridLayoutBehavior['host'] {
    return {
        renderComponent: vi.fn(),
        prefix: '',
        resolveToken: (v) => v,
        engine: {} as GridLayoutBehavior['host']['engine'],
        cleanupFns: [],
        findItemByKey: () => undefined,
    };
}

describe('renderUSWDSGrid', () => {
    it('renders grid-row grid-gap with equal tablet columns for 2 columns', () => {
        const parent = document.createElement('div');
        const host = mockHost();
        const behavior: GridLayoutBehavior = {
            comp: { columns: 2, children: [{ component: 'TextInput', bind: 'x' }] },
            host,
        };
        renderUSWDSGrid(behavior, parent, mockAdapterContext());
        const row = parent.querySelector('.grid-row.grid-gap');
        expect(row).toBeTruthy();
        const cell = parent.querySelector('.grid-col-12');
        expect(cell).toBeTruthy();
        expect(cell!.className).toContain('tablet:grid-col-6');
        expect(host.renderComponent).toHaveBeenCalledOnce();
    });

    it('uses tablet:grid-col-4 for 3 columns', () => {
        const parent = document.createElement('div');
        const behavior: GridLayoutBehavior = {
            comp: { columns: 3, children: [{ component: 'TextInput', bind: 'a' }] },
            host: mockHost(),
        };
        renderUSWDSGrid(behavior, parent, mockAdapterContext());
        const cell = parent.querySelector('.grid-col-12');
        expect(cell).toBeTruthy();
        expect(cell!.className).toContain('tablet:grid-col-4');
    });

    it('uses tablet:grid-col-fill for 5 equal columns (no 12-column divisor)', () => {
        const parent = document.createElement('div');
        const behavior: GridLayoutBehavior = {
            comp: { columns: 5, children: [{ component: 'TextInput', bind: 'x' }] },
            host: mockHost(),
        };
        renderUSWDSGrid(behavior, parent, mockAdapterContext());
        expect(parent.querySelector('.grid-row.grid-gap')).toBeTruthy();
        expect(parent.querySelector('.formspec-grid')).toBeNull();
        const cell = parent.querySelector('.grid-col-12');
        expect(cell?.className).toContain('tablet:grid-col-fill');
    });

    it('applies gap via inline style on USWDS row', () => {
        const parent = document.createElement('div');
        const behavior: GridLayoutBehavior = {
            comp: { columns: 2, gap: '1rem', children: [] },
            host: mockHost(),
        };
        renderUSWDSGrid(behavior, parent, mockAdapterContext());
        const row = parent.querySelector('.grid-row.grid-gap') as HTMLElement;
        expect(row).toBeTruthy();
        expect(row.style.gap).toBe('1rem');
        expect(parent.querySelector('.formspec-grid')).toBeNull();
    });
});

describe('renderUSWDSColumns', () => {
    it('renders USWDS row for columnCount 2 without widths or gap', () => {
        const parent = document.createElement('div');
        const host = mockHost();
        const behavior: ColumnsLayoutBehavior = {
            comp: { columnCount: 2, children: [{ component: 'TextInput', bind: 'a' }] },
            host,
        };
        renderUSWDSColumns(behavior, parent, mockAdapterContext());
        expect(parent.querySelector('.grid-row.grid-gap')).toBeTruthy();
        expect(parent.querySelector('.grid-col-12')?.className).toContain('tablet:grid-col-6');
        expect(host.renderComponent).toHaveBeenCalledOnce();
    });

    it('defaults to 2 columns when columnCount is omitted', () => {
        const parent = document.createElement('div');
        const behavior: ColumnsLayoutBehavior = {
            comp: { children: [{ component: 'TextInput', bind: 'b' }] },
            host: mockHost(),
        };
        renderUSWDSColumns(behavior, parent, mockAdapterContext());
        const cell = parent.querySelector('.grid-col-12');
        expect(cell?.className).toContain('tablet:grid-col-6');
    });

    it('falls back to formspec-columns when widths are set', () => {
        const parent = document.createElement('div');
        const behavior: ColumnsLayoutBehavior = {
            comp: { columnCount: 2, widths: ['1fr', '2fr'], children: [] },
            host: mockHost(),
        };
        renderUSWDSColumns(behavior, parent, mockAdapterContext());
        expect(parent.querySelector('.formspec-columns')).toBeTruthy();
        expect(parent.querySelector('.grid-row.grid-gap')).toBeNull();
    });

    it('applies gap via inline style on USWDS row', () => {
        const parent = document.createElement('div');
        const behavior: ColumnsLayoutBehavior = {
            comp: { columnCount: 2, gap: '2rem', children: [] },
            host: mockHost(),
        };
        renderUSWDSColumns(behavior, parent, mockAdapterContext());
        const row = parent.querySelector('.grid-row.grid-gap') as HTMLElement;
        expect(row.style.gap).toBe('2rem');
        expect(parent.querySelector('.formspec-columns')).toBeNull();
    });
});

describe('USWDS integrationCSS layout grid', () => {
    it('includes layout grid utilities targeting USWDS row + column cells', async () => {
        const { integrationCSS } = await import('../../src/uswds/integration-css');
        expect(integrationCSS).toContain('.grid-row');
        expect(integrationCSS).toContain('.grid-row.grid-gap');
        expect(integrationCSS).toContain('.usa-form-group');
    });
});
