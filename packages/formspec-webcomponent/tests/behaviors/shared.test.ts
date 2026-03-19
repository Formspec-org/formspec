import { describe, it, expect } from 'vitest';
import { resolveFieldPath, toFieldId, resolveAndStripTokens } from '../../src/behaviors/shared';

describe('resolveFieldPath', () => {
    it('returns bind key when no prefix', () => {
        expect(resolveFieldPath('name', '')).toBe('name');
    });

    it('joins prefix and bind with dot', () => {
        expect(resolveFieldPath('name', 'group[0]')).toBe('group[0].name');
    });
});

describe('toFieldId', () => {
    it('replaces dots and brackets with hyphens', () => {
        expect(toFieldId('group[0].name')).toBe('field-group-0--name');
    });

    it('handles simple path', () => {
        expect(toFieldId('name')).toBe('field-name');
    });
});

describe('resolveAndStripTokens', () => {
    it('resolves $token references in style values', () => {
        const block = { style: { color: '$token.primary' } };
        const resolve = (v: any) => v === '$token.primary' ? '#007bff' : v;
        const result = resolveAndStripTokens(block as any, resolve);
        expect(result.style).toEqual({ color: '#007bff' });
    });

    it('resolves $token references in cssClass string', () => {
        const block = { cssClass: '$token.fieldClass' };
        const resolve = (v: any) => v === '$token.fieldClass' ? 'usa-input' : v;
        const result = resolveAndStripTokens(block as any, resolve);
        expect(result.cssClass).toBe('usa-input');
    });

    it('resolves $token references in cssClass array', () => {
        const block = { cssClass: ['static', '$token.dynamic'] };
        const resolve = (v: any) => v === '$token.dynamic' ? 'resolved' : v;
        const result = resolveAndStripTokens(block as any, resolve);
        expect(result.cssClass).toEqual(['static', 'resolved']);
    });

    it('passes through non-token values', () => {
        const block = { style: { color: 'red' }, cssClass: 'plain' };
        const resolve = (v: any) => v;
        const result = resolveAndStripTokens(block as any, resolve);
        expect(result.style).toEqual({ color: 'red' });
        expect(result.cssClass).toBe('plain');
    });

    it('preserves other properties unchanged', () => {
        const block = { widget: 'TextInput', labelPosition: 'top' as const, widgetConfig: { rows: 5 } };
        const resolve = (v: any) => v;
        const result = resolveAndStripTokens(block as any, resolve);
        expect(result.widget).toBe('TextInput');
        expect(result.labelPosition).toBe('top');
        expect(result.widgetConfig).toEqual({ rows: 5 });
    });
});
