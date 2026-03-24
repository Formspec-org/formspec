import { describe, it, expect } from 'vitest';
import { extractScreenerSeedFromData, omitScreenerKeysFromData } from '../src/rendering/screener';

describe('extractScreenerSeedFromData', () => {
    const definition = {
        screener: {
            items: [
                { key: 'a', type: 'field', dataType: 'string' },
                { key: 'b', type: 'field', dataType: 'boolean' },
            ],
        },
    };

    it('returns null when no screener items or empty data', () => {
        expect(extractScreenerSeedFromData({}, { x: 1 })).toBeNull();
        expect(extractScreenerSeedFromData(definition, null)).toBeNull();
        expect(extractScreenerSeedFromData(definition, undefined)).toBeNull();
    });

    it('picks only keys that exist on screener items', () => {
        expect(
            extractScreenerSeedFromData(definition, {
                a: 'x',
                b: true,
                other: 99,
            }),
        ).toEqual({ a: 'x', b: true });
    });

    it('returns null when no screener keys overlap', () => {
        expect(extractScreenerSeedFromData(definition, { other: 1 })).toBeNull();
    });
});

describe('omitScreenerKeysFromData', () => {
    const definition = {
        screener: {
            items: [{ key: 'gate', type: 'field', dataType: 'string' }],
        },
    };

    it('drops only top-level screener keys', () => {
        expect(
            omitScreenerKeysFromData(definition, {
                gate: 'x',
                applicantInfo: { name: 'N' },
            }),
        ).toEqual({ applicantInfo: { name: 'N' } });
    });

    it('returns a copy when there is no screener', () => {
        const data = { a: 1 };
        const out = omitScreenerKeysFromData({}, data);
        expect(out).toEqual(data);
        expect(out).not.toBe(data);
    });
});
