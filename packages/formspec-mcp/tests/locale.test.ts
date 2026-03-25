/** @filedesc Tests for formspec_locale MCP tool: locale string and form string management. */
import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleLocale } from '../src/tools/locale.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── set_string ───────────────────────────────────────────────────────

describe('handleLocale — set_string', () => {
  it('sets a locale string for a key', () => {
    const { registry, projectId, project } = registryWithProject();
    // First load a locale document so there's a locale to target
    (project as any).core.dispatch({
      type: 'locale.load',
      payload: {
        document: {
          locale: 'fr',
          version: '0.1.0',
          targetDefinition: { url: '' },
          strings: {},
        },
      },
    });

    const result = handleLocale(registry, projectId, {
      action: 'set_string',
      locale_id: 'fr',
      key: 'name.label',
      value: 'Nom',
    });

    expect(result.isError).toBeUndefined();
    const locale = project.localeAt('fr');
    expect(locale?.strings['name.label']).toBe('Nom');
  });

  it('overwrites an existing locale string', () => {
    const { registry, projectId, project } = registryWithProject();
    (project as any).core.dispatch({
      type: 'locale.load',
      payload: {
        document: {
          locale: 'fr',
          version: '0.1.0',
          targetDefinition: { url: '' },
          strings: { 'name.label': 'Nom' },
        },
      },
    });

    const result = handleLocale(registry, projectId, {
      action: 'set_string',
      locale_id: 'fr',
      key: 'name.label',
      value: 'Prenom',
    });

    expect(result.isError).toBeUndefined();
    const locale = project.localeAt('fr');
    expect(locale?.strings['name.label']).toBe('Prenom');
  });
});

// ── remove_string ────────────────────────────────────────────────────

describe('handleLocale — remove_string', () => {
  it('removes a locale string', () => {
    const { registry, projectId, project } = registryWithProject();
    (project as any).core.dispatch({
      type: 'locale.load',
      payload: {
        document: {
          locale: 'es',
          version: '0.1.0',
          targetDefinition: { url: '' },
          strings: { 'title': 'Titulo' },
        },
      },
    });

    const result = handleLocale(registry, projectId, {
      action: 'remove_string',
      locale_id: 'es',
      key: 'title',
    });

    expect(result.isError).toBeUndefined();
    const locale = project.localeAt('es');
    expect(locale?.strings['title']).toBeUndefined();
  });
});

// ── list_strings ─────────────────────────────────────────────────────

describe('handleLocale — list_strings', () => {
  it('lists all strings for a locale', () => {
    const { registry, projectId } = registryWithProject();
    const project = registry.getProject(projectId);
    (project as any).core.dispatch({
      type: 'locale.load',
      payload: {
        document: {
          locale: 'de',
          version: '0.1.0',
          targetDefinition: { url: '' },
          strings: { 'field1': 'Feld1', 'field2': 'Feld2' },
        },
      },
    });

    const result = handleLocale(registry, projectId, {
      action: 'list_strings',
      locale_id: 'de',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('strings');
    expect(data.strings).toEqual({ 'field1': 'Feld1', 'field2': 'Feld2' });
  });

  it('lists all locales when no locale_id provided', () => {
    const { registry, projectId } = registryWithProject();
    const project = registry.getProject(projectId);
    (project as any).core.dispatch({
      type: 'locale.load',
      payload: {
        document: {
          locale: 'fr',
          version: '0.1.0',
          targetDefinition: { url: '' },
          strings: { 'a': '1' },
        },
      },
    });
    (project as any).core.dispatch({
      type: 'locale.load',
      payload: {
        document: {
          locale: 'de',
          version: '0.1.0',
          targetDefinition: { url: '' },
          strings: { 'b': '2' },
        },
      },
    });

    const result = handleLocale(registry, projectId, {
      action: 'list_strings',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('locales');
    expect(Object.keys(data.locales)).toHaveLength(2);
    expect(data.locales).toHaveProperty('fr');
    expect(data.locales).toHaveProperty('de');
  });

  it('returns empty strings for a fresh locale', () => {
    const { registry, projectId } = registryWithProject();
    const project = registry.getProject(projectId);
    (project as any).core.dispatch({
      type: 'locale.load',
      payload: {
        document: {
          locale: 'ja',
          version: '0.1.0',
          targetDefinition: { url: '' },
          strings: {},
        },
      },
    });

    const result = handleLocale(registry, projectId, {
      action: 'list_strings',
      locale_id: 'ja',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.strings).toEqual({});
  });
});

// ── set_form_string ──────────────────────────────────────────────────

describe('handleLocale — set_form_string', () => {
  it('sets a form-level metadata property on a locale', () => {
    const { registry, projectId, project } = registryWithProject();
    (project as any).core.dispatch({
      type: 'locale.load',
      payload: {
        document: {
          locale: 'fr',
          version: '0.1.0',
          targetDefinition: { url: '' },
          strings: {},
        },
      },
    });

    const result = handleLocale(registry, projectId, {
      action: 'set_form_string',
      locale_id: 'fr',
      property: 'title',
      value: 'Formulaire',
    });

    expect(result.isError).toBeUndefined();
    const locale = project.localeAt('fr');
    expect(locale?.title).toBe('Formulaire');
  });

  it('rejects invalid form string properties', () => {
    const { registry, projectId } = registryWithProject();
    const project = registry.getProject(projectId);
    (project as any).core.dispatch({
      type: 'locale.load',
      payload: {
        document: {
          locale: 'fr',
          version: '0.1.0',
          targetDefinition: { url: '' },
          strings: {},
        },
      },
    });

    const result = handleLocale(registry, projectId, {
      action: 'set_form_string',
      locale_id: 'fr',
      property: 'invalid_prop',
      value: 'test',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('COMMAND_FAILED');
  });
});

// ── list_form_strings ────────────────────────────────────────────────

describe('handleLocale — list_form_strings', () => {
  it('lists form-level strings for a locale', () => {
    const { registry, projectId } = registryWithProject();
    const project = registry.getProject(projectId);
    (project as any).core.dispatch({
      type: 'locale.load',
      payload: {
        document: {
          locale: 'fr',
          version: '0.1.0',
          targetDefinition: { url: '' },
          strings: {},
          name: 'Francais',
          title: 'Formulaire',
          description: 'Un formulaire',
        },
      },
    });

    const result = handleLocale(registry, projectId, {
      action: 'list_form_strings',
      locale_id: 'fr',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data).toHaveProperty('form_strings');
    expect(data.form_strings).toHaveProperty('name', 'Francais');
    expect(data.form_strings).toHaveProperty('title', 'Formulaire');
    expect(data.form_strings).toHaveProperty('description', 'Un formulaire');
  });
});

// ── WRONG_PHASE ──────────────────────────────────────────────────────

describe('handleLocale — errors', () => {
  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleLocale(registry, projectId, {
      action: 'set_string',
      locale_id: 'fr',
      key: 'test',
      value: 'test',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });

  it('returns error for unknown locale', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleLocale(registry, projectId, {
      action: 'set_string',
      locale_id: 'xx',
      key: 'test',
      value: 'test',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
  });
});
