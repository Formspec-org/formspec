import { describe, it, expect } from 'vitest';
import { resolveToken, emitMergedThemeCssVars } from '../src/index';

describe('resolveToken', () => {
    it('resolves a component token', () => {
        expect(resolveToken('$token.space.lg', { 'space.lg': '32px' }, undefined)).toBe('32px');
    });

    it('falls back to theme token', () => {
        expect(resolveToken('$token.space.lg', undefined, { 'space.lg': '24px' })).toBe('24px');
    });

    it('component token takes precedence over theme token', () => {
        expect(resolveToken('$token.space.lg', { 'space.lg': '32px' }, { 'space.lg': '24px' })).toBe('32px');
    });

    it('passes through non-token values', () => {
        expect(resolveToken('16px', undefined, undefined)).toBe('16px');
        expect(resolveToken(42, undefined, undefined)).toBe(42);
        expect(resolveToken(null, undefined, undefined)).toBe(null);
    });

    it('passes through unresolved token with warning', () => {
        const warn = console.warn;
        let warned = false;
        console.warn = () => { warned = true; };
        const result = resolveToken('$token.missing', undefined, undefined);
        console.warn = warn;
        expect(result).toBe('$token.missing');
        expect(warned).toBe(true);
    });
});

describe('emitMergedThemeCssVars', () => {
    it('merges component tokens over theme tokens on the target element', () => {
        const props: Record<string, string> = {};
        const el = {
            style: {
                setProperty(name: string, value: string) {
                    props[name] = value;
                },
                getPropertyValue(name: string) {
                    return props[name] ?? '';
                },
            },
        } as unknown as HTMLElement;
        emitMergedThemeCssVars(el, {
            themeTokens: { 'color.border': '#111111', 'color.primary': '#222222' },
            componentTokens: { 'color.border': '#999999' },
        });
        expect(el.style.getPropertyValue('--formspec-color-border')).toBe('#999999');
        expect(el.style.getPropertyValue('--formspec-color-primary')).toBe('#222222');
    });
});
