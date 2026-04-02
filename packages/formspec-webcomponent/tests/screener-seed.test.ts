import { describe, it, expect } from 'vitest';
import { extractScreenerSeedFromData, omitScreenerKeysFromData } from '../src/rendering/screener';

const minimalScreenerDoc = (items: Array<{ key: string; type: string; dataType: string }>) => ({
    $formspecScreener: '1.0',
    url: 'urn:test:screener',
    version: '1.0.0',
    title: 'Test',
    items,
    evaluation: [{ id: 'm', strategy: 'first-match', routes: [{ condition: 'true', target: 'urn:x' }] }],
});

describe('extractScreenerSeedFromData', () => {
    const screenerDocument = minimalScreenerDoc([
        { key: 'a', type: 'field', dataType: 'string' },
        { key: 'b', type: 'field', dataType: 'boolean' },
    ]);

    it('returns null when no screener items or empty data', () => {
        expect(extractScreenerSeedFromData(null, { x: 1 })).toBeNull();
        expect(extractScreenerSeedFromData(undefined, { x: 1 })).toBeNull();
        expect(extractScreenerSeedFromData(screenerDocument, null)).toBeNull();
        expect(extractScreenerSeedFromData(screenerDocument, undefined)).toBeNull();
    });

    it('picks only keys that exist on screener items', () => {
        expect(
            extractScreenerSeedFromData(screenerDocument, {
                a: 'x',
                b: true,
                other: 99,
            }),
        ).toEqual({ a: 'x', b: true });
    });

    it('returns null when no screener keys overlap', () => {
        expect(extractScreenerSeedFromData(screenerDocument, { other: 1 })).toBeNull();
    });
});

describe('omitScreenerKeysFromData', () => {
    const screenerDocument = minimalScreenerDoc([{ key: 'gate', type: 'field', dataType: 'string' }]);

    it('drops only top-level screener keys', () => {
        expect(
            omitScreenerKeysFromData(screenerDocument, {
                gate: 'x',
                applicantInfo: { name: 'N' },
            }),
        ).toEqual({ applicantInfo: { name: 'N' } });
    });

    it('returns a copy when there is no screener', () => {
        const data = { a: 1 };
        const out = omitScreenerKeysFromData(null, data);
        expect(out).toEqual(data);
        expect(out).not.toBe(data);
    });
});
