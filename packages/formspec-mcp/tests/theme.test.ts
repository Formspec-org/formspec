/** @filedesc Tests for formspec_theme MCP tool: token, default, and selector management. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleTheme } from '../src/tools/theme.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── Tokens ──────────────────────────────────────────────────────────

describe('handleTheme — tokens', () => {
  it('sets a design token', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleTheme(registry, projectId, {
      action: 'set_token',
      key: 'primaryColor',
      value: '#ff0000',
    });

    expect(result.isError).toBeUndefined();
  });

  it('lists tokens after setting one', () => {
    const { registry, projectId } = registryWithProject();
    handleTheme(registry, projectId, {
      action: 'set_token',
      key: 'primaryColor',
      value: '#ff0000',
    });

    const result = handleTheme(registry, projectId, { action: 'list_tokens' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('tokens');
    expect(data.tokens).toHaveProperty('primaryColor', '#ff0000');
  });

  it('removes a token', () => {
    const { registry, projectId } = registryWithProject();
    handleTheme(registry, projectId, {
      action: 'set_token',
      key: 'primaryColor',
      value: '#ff0000',
    });
    handleTheme(registry, projectId, {
      action: 'remove_token',
      key: 'primaryColor',
    });

    const result = handleTheme(registry, projectId, { action: 'list_tokens' });
    const data = parseResult(result);

    expect(data.tokens.primaryColor).toBeUndefined();
  });

  it('lists empty tokens for a fresh project', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleTheme(registry, projectId, { action: 'list_tokens' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('tokens');
  });
});

// ── Defaults ────────────────────────────────────────────────────────

describe('handleTheme — defaults', () => {
  it('sets a theme default', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleTheme(registry, projectId, {
      action: 'set_default',
      property: 'labelPosition',
      value: 'above',
    });

    expect(result.isError).toBeUndefined();
  });

  it('lists defaults after setting one', () => {
    const { registry, projectId } = registryWithProject();
    handleTheme(registry, projectId, {
      action: 'set_default',
      property: 'labelPosition',
      value: 'above',
    });

    const result = handleTheme(registry, projectId, { action: 'list_defaults' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('defaults');
    expect(data.defaults).toHaveProperty('labelPosition', 'above');
  });

  it('lists empty defaults for a fresh project', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleTheme(registry, projectId, { action: 'list_defaults' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('defaults');
  });
});

// ── Selectors ───────────────────────────────────────────────────────

describe('handleTheme — selectors', () => {
  it('adds a theme selector', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleTheme(registry, projectId, {
      action: 'add_selector',
      match: { dataType: 'email' },
      apply: { widgetHint: 'email' },
    });

    expect(result.isError).toBeUndefined();
  });

  it('lists selectors after adding one', () => {
    const { registry, projectId } = registryWithProject();
    handleTheme(registry, projectId, {
      action: 'add_selector',
      match: { dataType: 'email' },
      apply: { widgetHint: 'email' },
    });

    const result = handleTheme(registry, projectId, { action: 'list_selectors' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('selectors');
    expect(data.selectors).toHaveLength(1);
    expect(data.selectors[0]).toHaveProperty('match');
    expect(data.selectors[0]).toHaveProperty('apply');
  });

  it('lists empty selectors for a fresh project', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleTheme(registry, projectId, { action: 'list_selectors' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('selectors');
    expect(data.selectors).toHaveLength(0);
  });

  it('adds multiple selectors in order', () => {
    const { registry, projectId } = registryWithProject();
    handleTheme(registry, projectId, {
      action: 'add_selector',
      match: { type: 'field' },
      apply: { labelPosition: 'above' },
    });
    handleTheme(registry, projectId, {
      action: 'add_selector',
      match: { type: 'group' },
      apply: { labelPosition: 'inline' },
    });

    const result = handleTheme(registry, projectId, { action: 'list_selectors' });
    const data = parseResult(result);

    expect(data.selectors).toHaveLength(2);
  });
});

// ── WRONG_PHASE ─────────────────────────────────────────────────────

describe('handleTheme — errors', () => {
  it('returns WRONG_PHASE during bootstrap for mutations', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleTheme(registry, projectId, {
      action: 'set_token',
      key: 'color',
      value: 'red',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });

  it('returns WRONG_PHASE during bootstrap for reads', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleTheme(registry, projectId, { action: 'list_tokens' });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});
