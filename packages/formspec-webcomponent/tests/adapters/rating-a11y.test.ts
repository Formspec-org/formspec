import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderRating } from '../../src/adapters/default/rating';
import type { RatingBehavior } from '../../src/behaviors/types';
import type { AdapterContext } from '../../src/adapters/types';

function createMockBehavior(overrides: Partial<RatingBehavior> = {}): RatingBehavior {
    return {
        fieldPath: 'rating_field',
        id: 'rating-1',
        label: 'Rate this',
        hint: null,
        description: null,
        presentation: {},
        widgetClassSlots: {},
        compOverrides: {},
        remoteOptionsState: { loading: false, error: null },
        options: () => [],
        bind: vi.fn(() => () => {}),
        maxRating: 5,
        icon: '★',
        allowHalf: false,
        isInteger: true,
        setValue: vi.fn(),
        ...overrides,
    };
}

function createMockActx(): AdapterContext {
    return {
        onDispose: vi.fn(),
        applyCssClass: vi.fn(),
        applyStyle: vi.fn(),
        applyAccessibility: vi.fn(),
        applyClassValue: vi.fn(),
    };
}

describe('Rating accessibility', () => {
    let parent: HTMLDivElement;
    let behavior: RatingBehavior;
    let actx: AdapterContext;

    beforeEach(() => {
        parent = document.createElement('div');
        behavior = createMockBehavior();
        actx = createMockActx();
    });

    it('container has role="slider" with correct aria attributes', () => {
        renderRating(behavior, parent, actx);

        const container = parent.querySelector('.formspec-rating-stars')!;
        expect(container).toBeTruthy();
        expect(container.getAttribute('role')).toBe('slider');
        expect(container.getAttribute('tabindex')).toBe('0');
        expect(container.getAttribute('aria-valuemin')).toBe('0');
        expect(container.getAttribute('aria-valuemax')).toBe('5');
        expect(container.getAttribute('aria-valuenow')).toBe('0');
        expect(container.getAttribute('aria-valuetext')).toBe('0 of 5');
        expect(container.getAttribute('aria-label')).toBe('Rate this');
    });

    it('ArrowRight increments value by 1', () => {
        renderRating(behavior, parent, actx);

        const container = parent.querySelector('.formspec-rating-stars')!;
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

        expect(behavior.setValue).toHaveBeenCalledWith(1);
    });

    it('ArrowUp increments value by 1', () => {
        renderRating(behavior, parent, actx);

        const container = parent.querySelector('.formspec-rating-stars')!;
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

        expect(behavior.setValue).toHaveBeenCalledWith(1);
    });

    it('ArrowLeft decrements value, clamped to 0', () => {
        renderRating(behavior, parent, actx);

        const container = parent.querySelector('.formspec-rating-stars')!;
        // Start at 0, ArrowLeft should stay at 0
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        expect(behavior.setValue).toHaveBeenCalledWith(0);
    });

    it('ArrowDown decrements value, clamped to 0', () => {
        renderRating(behavior, parent, actx);

        const container = parent.querySelector('.formspec-rating-stars')!;
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(behavior.setValue).toHaveBeenCalledWith(0);
    });

    it('End sets value to maxRating', () => {
        renderRating(behavior, parent, actx);

        const container = parent.querySelector('.formspec-rating-stars')!;
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        expect(behavior.setValue).toHaveBeenCalledWith(5);
    });

    it('Home sets value to 0', () => {
        renderRating(behavior, parent, actx);

        const container = parent.querySelector('.formspec-rating-stars')!;
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        expect(behavior.setValue).toHaveBeenCalledWith(0);
    });

    it('increments by 0.5 when allowHalf is true', () => {
        behavior = createMockBehavior({ allowHalf: true });
        renderRating(behavior, parent, actx);

        const container = parent.querySelector('.formspec-rating-stars')!;
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(behavior.setValue).toHaveBeenCalledWith(0.5);
    });

    it('clamps increment to maxRating', () => {
        renderRating(behavior, parent, actx);

        const container = parent.querySelector('.formspec-rating-stars')!;
        // Hit ArrowRight 6 times — should clamp at 5
        for (let i = 0; i < 6; i++) {
            container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        }
        // Last call should be clamped to 5
        const calls = (behavior.setValue as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls[calls.length - 1][0]).toBe(5);
    });

    it('updates aria-valuenow and aria-valuetext on keyboard interaction', () => {
        renderRating(behavior, parent, actx);

        const container = parent.querySelector('.formspec-rating-stars')!;
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

        expect(container.getAttribute('aria-valuenow')).toBe('1');
        expect(container.getAttribute('aria-valuetext')).toBe('1 of 5');
    });
});
