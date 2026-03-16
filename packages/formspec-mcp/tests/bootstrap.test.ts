import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSchemas } from '../src/schemas.js';
import { registryInBootstrap } from './helpers.js';
import { handleDraft, handleLoad } from '../src/tools/bootstrap.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCHEMAS_DIR = resolve(__dirname, '../../../schemas');

// ── Minimal valid test documents ─────────────────────────────────────

const MINIMAL_DEFINITION = {
  $formspec: '1.0',
  url: 'urn:test:form',
  version: '1.0.0',
  status: 'draft',
  title: 'Test Form',
  items: [],
};

const MINIMAL_COMPONENT = {
  $formspecComponent: '1.0',
  version: '1.0.0',
  targetDefinition: { url: 'urn:test:form' },
  tree: { component: 'Stack', children: [] },
};

const MINIMAL_THEME = {
  $formspecTheme: '1.0',
  version: '1.0.0',
  targetDefinition: { url: 'urn:test:form' },
};

// ── Invalid documents ────────────────────────────────────────────────

const INVALID_DEFINITION = { bad: true };
const INVALID_COMPONENT = { bad: true };
const INVALID_THEME = { nonsense: 42 };

// ── Setup ────────────────────────────────────────────────────────────

beforeAll(() => {
  initSchemas(SCHEMAS_DIR);
});

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── handleDraft ──────────────────────────────────────────────────────

describe('handleDraft', () => {
  describe('type=definition', () => {
    it('accepts valid definition JSON and stores it on the draft', () => {
      const { registry, projectId } = registryInBootstrap();
      const result = handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);

      expect(result.isError).toBeUndefined();
      const draft = registry.getDraft(projectId);
      expect(draft.definition).toEqual(MINIMAL_DEFINITION);
      expect(draft.errors.has('definition')).toBe(false);
    });

    it('returns DRAFT_SCHEMA_ERROR for invalid definition JSON', () => {
      const { registry, projectId } = registryInBootstrap();
      const result = handleDraft(registry, projectId, 'definition', INVALID_DEFINITION);

      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.code).toBe('DRAFT_SCHEMA_ERROR');
    });

    it('stores invalid JSON on draft even when schema errors exist', () => {
      const { registry, projectId } = registryInBootstrap();
      handleDraft(registry, projectId, 'definition', INVALID_DEFINITION);

      const draft = registry.getDraft(projectId);
      expect(draft.definition).toEqual(INVALID_DEFINITION);
      expect(draft.errors.has('definition')).toBe(true);
      expect(draft.errors.get('definition')!.length).toBeGreaterThan(0);
    });

    it('includes error details with paths and messages', () => {
      const { registry, projectId } = registryInBootstrap();
      const result = handleDraft(registry, projectId, 'definition', INVALID_DEFINITION);

      const parsed = parseResult(result);
      expect(parsed.detail.artifactType).toBe('definition');
      expect(Array.isArray(parsed.detail.errors)).toBe(true);
      for (const err of parsed.detail.errors) {
        expect(typeof err.path).toBe('string');
        expect(typeof err.message).toBe('string');
      }
    });

    it('overwrites previous draft on resubmission', () => {
      const { registry, projectId } = registryInBootstrap();
      handleDraft(registry, projectId, 'definition', INVALID_DEFINITION);
      handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);

      const draft = registry.getDraft(projectId);
      expect(draft.definition).toEqual(MINIMAL_DEFINITION);
      expect(draft.errors.has('definition')).toBe(false);
    });

    it('returns WRONG_PHASE after load', () => {
      const { registry, projectId } = registryInBootstrap();
      handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);
      handleDraft(registry, projectId, 'component', MINIMAL_COMPONENT);
      handleLoad(registry, projectId);

      const result = handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);
      expect(result.isError).toBe(true);
      expect(parseResult(result).code).toBe('WRONG_PHASE');
    });
  });

  describe('type=component', () => {
    it('accepts valid component JSON and stores it', () => {
      const { registry, projectId } = registryInBootstrap();
      const result = handleDraft(registry, projectId, 'component', MINIMAL_COMPONENT);

      expect(result.isError).toBeUndefined();
      const draft = registry.getDraft(projectId);
      expect(draft.component).toEqual(MINIMAL_COMPONENT);
      expect(draft.errors.has('component')).toBe(false);
    });

    it('returns DRAFT_SCHEMA_ERROR for invalid component JSON', () => {
      const { registry, projectId } = registryInBootstrap();
      const result = handleDraft(registry, projectId, 'component', INVALID_COMPONENT);

      expect(result.isError).toBe(true);
      expect(parseResult(result).code).toBe('DRAFT_SCHEMA_ERROR');
    });

    it('returns WRONG_PHASE after load', () => {
      const { registry, projectId } = registryInBootstrap();
      handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);
      handleLoad(registry, projectId);

      const result = handleDraft(registry, projectId, 'component', MINIMAL_COMPONENT);
      expect(result.isError).toBe(true);
      expect(parseResult(result).code).toBe('WRONG_PHASE');
    });
  });

  describe('type=theme', () => {
    it('accepts valid theme JSON and stores it', () => {
      const { registry, projectId } = registryInBootstrap();
      const result = handleDraft(registry, projectId, 'theme', MINIMAL_THEME);

      expect(result.isError).toBeUndefined();
      const draft = registry.getDraft(projectId);
      expect(draft.theme).toEqual(MINIMAL_THEME);
      expect(draft.errors.has('theme')).toBe(false);
    });

    it('returns DRAFT_SCHEMA_ERROR for invalid theme JSON', () => {
      const { registry, projectId } = registryInBootstrap();
      const result = handleDraft(registry, projectId, 'theme', INVALID_THEME);

      expect(result.isError).toBe(true);
      expect(parseResult(result).code).toBe('DRAFT_SCHEMA_ERROR');
    });

    it('returns WRONG_PHASE after load', () => {
      const { registry, projectId } = registryInBootstrap();
      handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);
      handleLoad(registry, projectId);

      const result = handleDraft(registry, projectId, 'theme', MINIMAL_THEME);
      expect(result.isError).toBe(true);
      expect(parseResult(result).code).toBe('WRONG_PHASE');
    });
  });
});

// ── handleLoad ───────────────────────────────────────────────────────

describe('handleLoad', () => {
  it('transitions to authoring phase with valid definition + component', () => {
    const { registry, projectId } = registryInBootstrap();
    handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);
    handleDraft(registry, projectId, 'component', MINIMAL_COMPONENT);

    const result = handleLoad(registry, projectId);
    expect(result.isError).toBeUndefined();

    const project = registry.getProject(projectId);
    expect(project).toBeTruthy();
  });

  it('transitions with definition only (component and theme are optional)', () => {
    const { registry, projectId } = registryInBootstrap();
    handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);

    const result = handleLoad(registry, projectId);
    expect(result.isError).toBeUndefined();

    const project = registry.getProject(projectId);
    expect(project).toBeTruthy();
  });

  it('fails with DRAFT_INVALID when definition has schema errors', () => {
    const { registry, projectId } = registryInBootstrap();
    handleDraft(registry, projectId, 'definition', INVALID_DEFINITION);

    const result = handleLoad(registry, projectId);
    expect(result.isError).toBe(true);
    expect(parseResult(result).code).toBe('DRAFT_INVALID');
  });

  it('transitions to authoring with a blank project when no definition is present', () => {
    const { registry, projectId } = registryInBootstrap();

    const result = handleLoad(registry, projectId);
    expect(result.isError).toBeUndefined();
    const parsed = parseResult(result);
    expect(parsed.phase).toBe('authoring');
    expect(parsed.statistics).toBeDefined();

    const project = registry.getProject(projectId);
    expect(project).toBeTruthy();
  });

  it('returns WRONG_PHASE when called after already loaded', () => {
    const { registry, projectId } = registryInBootstrap();
    handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);
    handleDraft(registry, projectId, 'component', MINIMAL_COMPONENT);
    handleLoad(registry, projectId);

    const result = handleLoad(registry, projectId);
    expect(result.isError).toBe(true);
    expect(parseResult(result).code).toBe('WRONG_PHASE');
  });

  it('returns project statistics on success', () => {
    const { registry, projectId } = registryInBootstrap();
    handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);
    handleDraft(registry, projectId, 'component', MINIMAL_COMPONENT);

    const result = handleLoad(registry, projectId);
    expect(result.isError).toBeUndefined();
    const parsed = parseResult(result);
    expect(parsed.statistics).toBeDefined();
    expect(typeof parsed.statistics.fieldCount).toBe('number');
  });

  it('loads all three artifacts (definition + component + theme)', () => {
    const { registry, projectId } = registryInBootstrap();
    handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);
    handleDraft(registry, projectId, 'component', MINIMAL_COMPONENT);
    handleDraft(registry, projectId, 'theme', MINIMAL_THEME);

    const result = handleLoad(registry, projectId);
    expect(result.isError).toBeUndefined();

    const project = registry.getProject(projectId);
    expect(project).toBeTruthy();
    expect(parseResult(result).phase).toBe('authoring');
  });

  it('returns diagnostics counts on success', () => {
    const { registry, projectId } = registryInBootstrap();
    handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);
    handleDraft(registry, projectId, 'component', MINIMAL_COMPONENT);

    const result = handleLoad(registry, projectId);
    expect(result.isError).toBeUndefined();
    const parsed = parseResult(result);
    expect(parsed.diagnostics).toBeDefined();
    expect(typeof parsed.diagnostics.error).toBe('number');
    expect(typeof parsed.diagnostics.warning).toBe('number');
    expect(typeof parsed.diagnostics.info).toBe('number');
  });

  it('returns PROJECT_NOT_FOUND for unknown projectId', () => {
    const { registry } = registryInBootstrap();
    const result = handleLoad(registry, 'nonexistent-id');
    expect(result.isError).toBe(true);
    expect(parseResult(result).code).toBe('PROJECT_NOT_FOUND');
  });

  it('reports errors from component draft', () => {
    const { registry, projectId } = registryInBootstrap();
    handleDraft(registry, projectId, 'definition', MINIMAL_DEFINITION);
    handleDraft(registry, projectId, 'component', INVALID_COMPONENT);

    const result = handleLoad(registry, projectId);
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.code).toBe('DRAFT_INVALID');
    expect(parsed.detail.errors.length).toBeGreaterThan(0);
    expect(parsed.detail.errors[0].artifactType).toBe('component');
  });
});
