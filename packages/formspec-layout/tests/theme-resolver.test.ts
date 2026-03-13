import { describe, it, expect } from 'vitest';
import { resolvePresentation, resolveWidget, widgetTokenToComponent, type ThemeDocument, type ItemDescriptor } from '../src/index';

describe('resolvePresentation', () => {
    it('returns empty block with no theme', () => {
        const item: ItemDescriptor = { key: 'name', type: 'field', dataType: 'string' };
        const result = resolvePresentation(null, item);
        expect(result).toEqual({});
    });

    it('applies theme defaults', () => {
        const theme = {
            $formspecTheme: '1.0' as const,
            version: '1.0.0',
            targetDefinition: { url: 'test' },
            defaults: { labelPosition: 'top' as const },
        };
        const item: ItemDescriptor = { key: 'name', type: 'field' };
        const result = resolvePresentation(theme, item);
        expect(result.labelPosition).toBe('top');
    });

    it('applies selector matches', () => {
        const theme = {
            $formspecTheme: '1.0' as const,
            version: '1.0.0',
            targetDefinition: { url: 'test' },
            selectors: [
                { match: { type: 'field' as const }, apply: { widget: 'TextInput' } },
            ],
        };
        const item: ItemDescriptor = { key: 'name', type: 'field' };
        const result = resolvePresentation(theme, item);
        expect(result.widget).toBe('TextInput');
    });

    it('applies per-item overrides (highest priority)', () => {
        const theme = {
            $formspecTheme: '1.0' as const,
            version: '1.0.0',
            targetDefinition: { url: 'test' },
            defaults: { widget: 'TextInput' },
            items: { email: { widget: 'Select' } },
        };
        const item: ItemDescriptor = { key: 'email', type: 'field' };
        const result = resolvePresentation(theme, item);
        expect(result.widget).toBe('Select');
    });

    it('unions cssClass across levels', () => {
        const theme = {
            $formspecTheme: '1.0' as const,
            version: '1.0.0',
            targetDefinition: { url: 'test' },
            defaults: { cssClass: 'default-class' },
            selectors: [
                { match: { type: 'field' as const }, apply: { cssClass: 'selector-class' } },
            ],
        };
        const item: ItemDescriptor = { key: 'name', type: 'field' };
        const result = resolvePresentation(theme, item);
        expect(result.cssClass).toContain('default-class');
        expect(result.cssClass).toContain('selector-class');
    });

    it('applies Tier 1 formPresentation labelPosition', () => {
        const item: ItemDescriptor = { key: 'name', type: 'field' };
        const result = resolvePresentation(null, item, {
            formPresentation: { labelPosition: 'start' },
        });
        expect(result.labelPosition).toBe('start');
    });
});

describe('resolveWidget', () => {
    it('returns preferred widget when available', () => {
        const result = resolveWidget({ widget: 'Slider' }, () => true);
        expect(result).toBe('Slider');
    });

    it('maps spec widget vocabulary to concrete component types', () => {
        expect(widgetTokenToComponent('radio')).toBe('RadioGroup');
        expect(widgetTokenToComponent('dropdown')).toBe('Select');
        expect(widgetTokenToComponent('datePicker')).toBe('DatePicker');
    });

    it('falls back to fallback chain', () => {
        const result = resolveWidget(
            { widget: 'Slider', fallback: ['NumberInput'] },
            (type) => type !== 'Slider',
        );
        expect(result).toBe('NumberInput');
    });

    it('accepts spec widget names in theme fallback chains', () => {
        const result = resolveWidget(
            { widget: 'segmented', fallback: ['radio'] },
            (type) => type === 'RadioGroup',
        );
        expect(result).toBe('RadioGroup');
    });

    it('returns null when no widget specified', () => {
        const result = resolveWidget({}, () => true);
        expect(result).toBeNull();
    });

    it('returns null when no fallback matches', () => {
        const warn = console.warn;
        console.warn = () => {};
        const result = resolveWidget({ widget: 'Unknown' }, () => false);
        console.warn = warn;
        expect(result).toBeNull();
    });
});
