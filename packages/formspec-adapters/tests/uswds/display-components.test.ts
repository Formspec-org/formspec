/** @filedesc USWDS display adapter smoke tests. */
import { describe, it, expect, vi } from 'vitest';
import type { DisplayComponentBehavior } from '@formspec-org/webcomponent';
import { renderUSWDSAlert, renderUSWDSBadge, renderUSWDSHeading, renderUSWDSCard } from '../../src/uswds/display-components';
import { mockAdapterContext } from '../helpers';

function mockHost(): DisplayComponentBehavior['host'] {
    return {
        engine: {} as any,
        prefix: '',
        cleanupFns: [],
        resolveCompText: (_c, _p, fb) => fb,
        renderComponent: vi.fn(),
        resolveToken: (v) => v,
        findItemByKey: () => null,
        resolveValidationTarget: () =>
            ({ path: '', label: '', formLevel: true, jumpable: false } as any),
        focusField: () => false,
        latestSubmitDetailSignal: { value: null } as any,
        touchedVersion: { value: 0 } as any,
    };
}

describe('USWDS display', () => {
    it('renderUSWDSHeading wraps in usa-prose', () => {
        const parent = document.createElement('div');
        const behavior: DisplayComponentBehavior = {
            comp: { text: 'Hi', level: 2 },
            host: mockHost(),
        };
        renderUSWDSHeading(behavior, parent, mockAdapterContext());
        expect(parent.querySelector('.usa-prose .formspec-heading')).toBeTruthy();
        expect(parent.querySelector('h2')?.textContent).toBe('Hi');
    });

    it('renderUSWDSCard uses usa-card structure', () => {
        const parent = document.createElement('div');
        const behavior: DisplayComponentBehavior = {
            comp: { title: 'T', children: [] },
            host: mockHost(),
        };
        renderUSWDSCard(behavior, parent, mockAdapterContext());
        expect(parent.querySelector('.usa-card .usa-card__heading')?.textContent).toBe('T');
    });

    it('renderUSWDSAlert uses usa-alert body', () => {
        const parent = document.createElement('div');
        const behavior: DisplayComponentBehavior = {
            comp: { text: 'Msg', severity: 'info' },
            host: mockHost(),
        };
        renderUSWDSAlert(behavior, parent, mockAdapterContext());
        expect(parent.querySelector('.usa-alert.usa-alert--info .usa-alert__text')?.textContent).toBe('Msg');
    });

    it('renderUSWDSBadge uses usa-tag', () => {
        const parent = document.createElement('div');
        const behavior: DisplayComponentBehavior = {
            comp: { text: 'New', variant: 'success' },
            host: mockHost(),
        };
        renderUSWDSBadge(behavior, parent, mockAdapterContext());
        const tag = parent.querySelector('.usa-tag');
        expect(tag?.textContent).toBe('New');
        expect(tag?.className).toContain('formspec-uswds-tag--success');
    });
});
