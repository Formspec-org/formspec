import { describe, it, expect } from 'vitest';
import { mergeFormPresentationForPlanning } from '../src/form-presentation.js';

describe('mergeFormPresentationForPlanning', () => {
    it('returns undefined when both inputs are absent', () => {
        expect(mergeFormPresentationForPlanning(undefined, undefined)).toBeUndefined();
    });

    it('returns definition-only when no component document block', () => {
        expect(
            mergeFormPresentationForPlanning({ pageMode: 'wizard', showProgress: true }, undefined),
        ).toEqual({ pageMode: 'wizard', showProgress: true });
    });

    it('lets component document override definition keys', () => {
        expect(
            mergeFormPresentationForPlanning(
                { pageMode: 'single', labelPosition: 'top' },
                { pageMode: 'wizard', showProgress: false },
            ),
        ).toEqual({ pageMode: 'wizard', showProgress: false, labelPosition: 'top' });
    });
});
