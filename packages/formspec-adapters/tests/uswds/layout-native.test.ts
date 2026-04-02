/** @filedesc Smoke tests for USWDS-native layout renderers (Page, Stack, Divider, Collapsible, Panel). */
import { describe, it, expect, vi } from 'vitest';
import type {
    PageLayoutBehavior,
    StackLayoutBehavior,
    DividerLayoutBehavior,
    CollapsibleLayoutBehavior,
    PanelLayoutBehavior,
} from '@formspec-org/webcomponent';
import { renderUSWDSPage } from '../../src/uswds/layout/page';
import { renderUSWDSStack } from '../../src/uswds/layout/stack';
import { renderUSWDSDivider } from '../../src/uswds/layout/divider';
import { renderUSWDSCollapsible } from '../../src/uswds/layout/collapsible';
import { renderUSWDSPanel } from '../../src/uswds/layout/panel';
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

    it('renderUSWDSStack horizontal uses tablet:grid-col-auto cells', () => {
        const parent = document.createElement('div');
        const behavior: StackLayoutBehavior = {
            comp: { direction: 'horizontal', children: [{ component: 'TextInput', bind: 'a' }] },
            host: layoutHost(),
        };
        renderUSWDSStack(behavior, parent, mockAdapterContext());
        const cell = parent.querySelector('[class*="tablet:grid-col-auto"]');
        expect(cell).toBeTruthy();
        expect(cell!.className).toContain('grid-col-12');
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
});
