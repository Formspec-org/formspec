import { describe, it, expect } from 'vitest';
import { resolveThemeCascade } from '../src/index.js';
import type { ThemeState } from '../src/index.js';

describe('resolveThemeCascade', () => {
  it('returns defaults when no selectors or item overrides exist', () => {
    const theme: ThemeState = {
      defaults: { labelPosition: 'top', widget: 'text-input' },
    };
    const result = resolveThemeCascade(theme, 'name', 'field');
    expect(result.labelPosition).toEqual({ value: 'top', source: 'default' });
    expect(result.widget).toEqual({ value: 'text-input', source: 'default' });
  });

  it('selector overrides default, provenance says selector', () => {
    const theme: ThemeState = {
      defaults: { widget: 'text-input' },
      selectors: [
        { match: { type: 'field', dataType: 'money' }, apply: { widget: 'moneyInput' } },
      ],
    };
    const result = resolveThemeCascade(theme, 'amount', 'field', 'money');
    expect(result.widget).toEqual({
      value: 'moneyInput',
      source: 'selector',
      sourceDetail: 'selector #1: field + money',
    });
  });

  it('item override wins over selector, provenance says item-override', () => {
    const theme: ThemeState = {
      defaults: { widget: 'text-input' },
      selectors: [
        { match: { type: 'field' }, apply: { widget: 'custom-widget' } },
      ],
      items: {
        name: { widget: 'fancy-input' },
      },
    };
    const result = resolveThemeCascade(theme, 'name', 'field');
    expect(result.widget).toEqual({
      value: 'fancy-input',
      source: 'item-override',
    });
  });

  it('multiple selectors merge in order', () => {
    const theme: ThemeState = {
      selectors: [
        { match: { type: 'field' }, apply: { widget: 'base-widget', cssClass: 'field-base' } },
        { match: { dataType: 'money' }, apply: { widget: 'moneyInput' } },
      ],
    };
    const result = resolveThemeCascade(theme, 'amount', 'field', 'money');
    // Second selector overrides widget, but cssClass from first persists
    expect(result.widget?.value).toBe('moneyInput');
    expect(result.cssClass?.value).toBe('field-base');
  });

  it('unmatched selectors are skipped', () => {
    const theme: ThemeState = {
      defaults: { widget: 'text-input' },
      selectors: [
        { match: { type: 'group' }, apply: { widget: 'group-widget' } },
      ],
    };
    const result = resolveThemeCascade(theme, 'name', 'field');
    expect(result.widget).toEqual({ value: 'text-input', source: 'default' });
  });

  it('empty theme returns empty record', () => {
    const result = resolveThemeCascade({}, 'name', 'field');
    expect(result).toEqual({});
  });
});
