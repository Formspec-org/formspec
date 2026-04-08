/** @filedesc Smoke tests for USWDS-native layout renderers (Page, Stack, Divider, Collapsible, Panel). */
import { describe, it, expect, vi } from 'vitest';
import type {
    PageLayoutBehavior,
    StackLayoutBehavior,
    DividerLayoutBehavior,
    CollapsibleLayoutBehavior,
    PanelLayoutBehavior,
    ModalLayoutBehavior,
} from '@formspec-org/webcomponent';
import { renderUSWDSPage } from '../../src/uswds/layout/page';
import { renderUSWDSStack } from '../../src/uswds/layout/stack';
import { renderUSWDSDivider } from '../../src/uswds/layout/divider';
import { renderUSWDSCollapsible } from '../../src/uswds/layout/collapsible';
import { renderUSWDSPanel } from '../../src/uswds/layout/panel';
import { renderUSWDSModal } from '../../src/uswds/layout/modal';
import { mockAdapterContext } from '../helpers';

function layoutHost() {
    return {
        renderComponent: vi.fn(),
        prefix: '',
        resolveToken: (v: string) => v,
        engine: {} as any,
        cleanupFns: [] as (() => void)[],
        findItemByKey: () => undefined,
    };
}

describe('USWDS layout natives', () => {
    it('renderUSWDSPage uses usa-section, grid-container, usa-prose', () => {
        const parent = document.createElement('div');
        const behavior: PageLayoutBehavior = {
            comp: { children: [] },
            host: layoutHost(),
            titleText: 'T',
            headingLevel: 'h2',
            descriptionText: null,
        };
        renderUSWDSPage(behavior, parent, mockAdapterContext());
        expect(parent.querySelector('section.usa-section.formspec-page')).toBeTruthy();
        expect(parent.querySelector('.grid-container > .usa-prose')).toBeTruthy();
    });

    it('renderUSWDSPage skips the outer page shell inside wizard and tab panels', () => {
        const wizardPanel = document.createElement('div');
        wizardPanel.className = 'formspec-wizard-panel';
        const host = layoutHost();
        const behavior: PageLayoutBehavior = {
            comp: { children: [{ component: 'TextInput', bind: 'firstName' }] },
            host,
            titleText: 'Step 1',
            headingLevel: 'h2',
            descriptionText: null,
        };
        renderUSWDSPage(behavior, wizardPanel, mockAdapterContext());
        expect(wizardPanel.querySelector('.formspec-page')).toBeNull();
        expect(host.renderComponent).toHaveBeenCalledTimes(1);
    });

    it('renderUSWDSStack vertical uses grid-row and full-width cells', () => {
        const parent = document.createElement('div');
        const behavior: StackLayoutBehavior = {
            comp: { children: [{ component: 'TextInput', bind: 'a' }] },
            host: layoutHost(),
        };
        renderUSWDSStack(behavior, parent, mockAdapterContext());
        const row = parent.querySelector('.formspec-stack.grid-row.grid-gap');
        expect(row).toBeTruthy();
        expect(parent.querySelector('.grid-col-12')).toBeTruthy();
    });

    it('renderUSWDSStack vertical stores custom stack spacing as a CSS variable instead of flex gap', () => {
        const parent = document.createElement('div');
        const behavior: StackLayoutBehavior = {
            comp: { gap: '12px', children: [{ component: 'TextInput', bind: 'a' }] },
            host: layoutHost(),
        };
        renderUSWDSStack(behavior, parent, mockAdapterContext());
        const row = parent.querySelector('.formspec-stack.grid-row.grid-gap') as HTMLDivElement | null;
        expect(row).not.toBeNull();
        expect(row?.style.gap).toBe('');
        expect(row?.style.getPropertyValue('--formspec-uswds-stack-gap')).toBe('12px');
    });

    it('renderUSWDSStack horizontal uses fill cells when children do not declare widths', () => {
        const parent = document.createElement('div');
        const behavior: StackLayoutBehavior = {
            comp: { direction: 'horizontal', children: [{ component: 'TextInput', bind: 'a' }] },
            host: layoutHost(),
        };
        renderUSWDSStack(behavior, parent, mockAdapterContext());
        const cell = parent.querySelector('[class*="tablet:grid-col-fill"]');
        expect(cell).toBeTruthy();
        expect(cell!.className).toContain('grid-col-12');
    });

    it('renderUSWDSStack horizontal keeps spacing in columnGap for side-by-side layouts', () => {
        const parent = document.createElement('div');
        const behavior: StackLayoutBehavior = {
            comp: { direction: 'horizontal', gap: '24px', children: [{ component: 'TextInput', bind: 'a' }] },
            host: layoutHost(),
        };
        renderUSWDSStack(behavior, parent, mockAdapterContext());
        const row = parent.querySelector('.formspec-stack.grid-row.grid-gap') as HTMLDivElement | null;
        expect(row).not.toBeNull();
        expect(row?.style.columnGap).toBe('24px');
        expect(row?.style.gap).toBe('');
    });

    it('renderUSWDSStack horizontal lets only explicit-width children use auto columns', () => {
        const parent = document.createElement('div');
        const behavior: StackLayoutBehavior = {
            comp: {
                direction: 'horizontal',
                children: [
                    { component: 'Panel', width: '200px', children: [] },
                    { component: 'Stack', children: [{ component: 'TextInput', bind: 'a' }] },
                ],
            },
            host: layoutHost(),
        };
        renderUSWDSStack(behavior, parent, mockAdapterContext());
        const cells = Array.from(parent.querySelectorAll('.formspec-stack > div')) as HTMLDivElement[];
        expect(cells[0]?.className).toContain('tablet:grid-col-auto');
        expect(cells[1]?.className).toContain('tablet:grid-col-fill');
    });

    it('renderUSWDSDivider renders hr.formspec-uswds-divider', () => {
        const parent = document.createElement('div');
        const behavior: DividerLayoutBehavior = { comp: {}, labelText: null };
        renderUSWDSDivider(behavior, parent, mockAdapterContext());
        expect(parent.querySelector('hr.formspec-uswds-divider')).toBeTruthy();
    });

    it('renderUSWDSCollapsible uses usa-accordion button and content', () => {
        const parent = document.createElement('div');
        const behavior: CollapsibleLayoutBehavior = {
            comp: { children: [] },
            host: layoutHost(),
            titleText: 'More',
        };
        renderUSWDSCollapsible(behavior, parent, mockAdapterContext());
        expect(parent.querySelector('.usa-accordion .usa-accordion__button')).toBeTruthy();
        expect(parent.querySelector('.usa-accordion__content.usa-prose')).toBeTruthy();
    });

    it('renderUSWDSPanel uses usa-card structure', () => {
        const parent = document.createElement('div');
        const behavior: PanelLayoutBehavior = {
            comp: { children: [] },
            host: layoutHost(),
            titleText: 'Aside',
        };
        renderUSWDSPanel(behavior, parent, mockAdapterContext());
        expect(parent.querySelector('.usa-card .usa-card__container')).toBeTruthy();
        expect(parent.querySelector('.usa-card__heading')?.textContent).toBe('Aside');
        expect(parent.querySelector('.usa-card__body')).toBeTruthy();
    });

    it('renderUSWDSModal keeps the dialog hidden until the trigger opens it', () => {
        const parent = document.createElement('div');
        const behavior: ModalLayoutBehavior = {
            comp: { children: [], triggerLabel: 'Open details' },
            host: layoutHost(),
            titleText: 'Details',
            triggerLabelText: 'Open details',
        };
        renderUSWDSModal(behavior, parent, mockAdapterContext());
        const dialog = parent.querySelector('dialog.usa-modal') as HTMLDialogElement | null;
        const trigger = Array.from(parent.querySelectorAll('button')).find((el) => el.textContent === 'Open details') as HTMLButtonElement | null;
        expect(dialog).not.toBeNull();
        expect(trigger?.textContent).toBe('Open details');
        expect(dialog?.hidden).toBe(true);
        expect(dialog?.getAttribute('hidden')).toBe('');
        expect(dialog?.style.display).toBe('none');
    });
});
