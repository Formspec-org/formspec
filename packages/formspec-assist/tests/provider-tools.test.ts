import { beforeAll, describe, expect, it } from 'vitest';
import { FormEngine } from '@formspec-org/engine';
import { createAssistProvider } from '../src/index.js';
import {
  createEngine,
  ensureEngine,
  makeComponent,
  makeDefinition,
  makeOntology,
  makeProfile,
  makeReferences,
  makeTheme,
  MemoryStorage,
} from './helpers.js';

describe('Assist provider tools', () => {
  beforeAll(async () => {
    await ensureEngine();
  });

  it('exposes tool declarations and structured core/profile/navigation tool behavior', async () => {
    const engine = createEngine();
    const provider = createAssistProvider({
      engine,
      references: makeReferences(),
      ontology: makeOntology(),
      profile: makeProfile(),
      storage: new MemoryStorage(),
      registries: [
        {
          $formspecRegistry: '1.0',
          publisher: { name: 'Example', url: 'https://example.org' },
          published: '2026-03-26T00:00:00Z',
          entries: [
            {
              name: 'x-concept-org-name',
              category: 'concept',
              version: '1.0.0',
              status: 'stable',
              description: 'Organization name',
              compatibility: { formspecVersion: '^1.0.0' },
              conceptUri: 'https://schema.org/name',
              conceptSystem: 'https://schema.org',
              conceptCode: 'name',
            },
          ],
        },
      ],
      registerWebMCP: false,
      now: () => new Date('2026-03-26T12:00:00.000Z'),
    });

    expect(provider.getTools().map((tool) => tool.name)).toContain('formspec.field.help');

    const parse = async (name: string, input: Record<string, unknown>) => {
      const result = await provider.invokeTool(name, input);
      expect(result.isError).not.toBe(true);
      expect(result.content).toHaveLength(1);
      return JSON.parse(result.content[0].text);
    };

    const formDescription = await parse('formspec.form.describe', {});
    expect(formDescription.title).toBe('Grant Application');

    const fieldList = await parse('formspec.field.list', { filter: 'all' });
    expect(fieldList.map((field: { path: string }) => field.path)).toContain('organization.ein');

    const fieldDescription = await parse('formspec.field.describe', { path: 'organization.ein' });
    expect(fieldDescription.help.concept.concept).toBe('https://www.irs.gov/terms/employer-identification-number');

    const progressBefore = await parse('formspec.form.progress', {});
    expect(progressBefore.required).toBe(3);
    expect(progressBefore.filled).toBe(1);

    const setResult = await parse('formspec.field.set', {
      path: 'organization.ein',
      value: '12-3456789',
    });
    expect(setResult.accepted).toBe(true);

    const bulkSetResult = await parse('formspec.field.bulkSet', {
      entries: [
        { path: 'organization.name', value: 'Acme Foundation' },
        { path: 'contactEmail', value: 'owner@example.org' },
      ],
    });
    expect(bulkSetResult.summary.accepted).toBe(2);

    const validateResult = await parse('formspec.form.validate', {});
    expect(validateResult.valid).toBe(true);

    const matchResult = await parse('formspec.profile.match', {});
    expect(matchResult.matches.some((match: { path: string }) => match.path === 'organization.ein')).toBe(true);

    const applyResult = await parse('formspec.profile.apply', {
      matches: [{ path: 'contactEmail', value: 'owner@example.org' }],
    });
    expect(applyResult.filled).toEqual([{ path: 'contactEmail', value: 'owner@example.org' }]);

    const learnResult = await parse('formspec.profile.learn', {});
    expect(learnResult.savedConcepts).toBeGreaterThan(0);

    const pagesResult = await parse('formspec.form.pages', {});
    expect(pagesResult.pages.map((page: { id: string }) => page.id)).toEqual(['org', 'details']);
    expect(pagesResult.pages[0].title).toBeUndefined();

    const nextIncomplete = await parse('formspec.form.nextIncomplete', {});
    expect(nextIncomplete).toMatchObject({
      path: 'details.summary',
      reason: 'empty',
    });
  });

  it('returns structured tool errors for readonly fields', async () => {
    const provider = createAssistProvider({
      engine: createEngine(),
      registerWebMCP: false,
    });

    const result = await provider.invokeTool('formspec.field.set', {
      path: 'derivedScore',
      value: 5,
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).code).toBe('READONLY');
  });

  it('requires explicit confirmation before applying profile values when requested', async () => {
    const engine = createEngine();
    const provider = createAssistProvider({
      engine,
      registerWebMCP: false,
    });

    const blocked = await provider.invokeTool('formspec.profile.apply', {
      matches: [{ path: 'contactEmail', value: 'owner@example.org' }],
      confirm: true,
    });
    expect(blocked.isError).toBe(true);
    expect(JSON.parse(blocked.content[0].text).code).toBe('x-confirmation-required');
    expect(engine.getFieldVM('contactEmail')?.value.value).toBe('');

    const confirmedProvider = createAssistProvider({
      engine: createEngine(),
      confirmProfileApply: () => true,
      registerWebMCP: false,
    });

    const confirmed = await confirmedProvider.invokeTool('formspec.profile.apply', {
      matches: [{ path: 'contactEmail', value: 'owner@example.org' }],
      confirm: true,
    });
    expect(confirmed.isError).not.toBe(true);
    expect(JSON.parse(confirmed.content[0].text).filled).toEqual([
      { path: 'contactEmail', value: 'owner@example.org' },
    ]);
  });

  it('supports profile-scoped match and learn operations', async () => {
    const storage = new MemoryStorage();
    const alternateProfile = {
      ...makeProfile(),
      id: 'secondary',
      label: 'Secondary',
      concepts: {
        ...makeProfile().concepts,
        'https://www.irs.gov/terms/employer-identification-number': {
          ...makeProfile().concepts['https://www.irs.gov/terms/employer-identification-number'],
          value: '98-7654321',
        },
      },
    };
    storage.setItem('formspec-assist:profiles', JSON.stringify([makeProfile(), alternateProfile]));

    const engine = createEngine();
    const provider = createAssistProvider({
      engine,
      ontology: makeOntology(),
      storage,
      registerWebMCP: false,
      now: () => new Date('2026-03-26T12:00:00.000Z'),
    });

    const matchResult = await provider.invokeTool('formspec.profile.match', { profileId: 'secondary' });
    expect(matchResult.isError).not.toBe(true);
    expect(JSON.parse(matchResult.content[0].text).matches.find((match: { path: string }) => match.path === 'organization.ein').value)
      .toBe('98-7654321');

    engine.getFieldVM('organization.ein')?.setValue('11-1111111');
    engine.getFieldVM('organization.name')?.setValue('New Org');
    const learnResult = await provider.invokeTool('formspec.profile.learn', { profileId: 'secondary' });
    expect(learnResult.isError).not.toBe(true);

    const learnedMatches = provider.matchProfile('secondary');
    expect(learnedMatches.find((match) => match.path === 'organization.ein')?.value).toBe('11-1111111');
    expect(learnedMatches.find((match) => match.path === 'organization.name')?.value).toBe('New Org');
  });

  it('filters readonly fields from profile match suggestions', async () => {
    const provider = createAssistProvider({
      engine: createEngine(),
      profile: {
        ...makeProfile(),
        fields: {
          ...makeProfile().fields,
          derivedScore: {
            value: 42,
            confidence: 1,
            source: { type: 'manual', timestamp: '2026-03-26T12:00:00.000Z' },
            lastUsed: '2026-03-26T12:00:00.000Z',
            verified: true,
          },
        },
      },
      registerWebMCP: false,
    });

    const result = await provider.invokeTool('formspec.profile.match', {});
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(result.content[0].text).matches.some((match: { path: string }) => match.path === 'derivedScore')).toBe(false);
  });

  it('rebinds resolver state when attaching a new engine', () => {
    const provider = createAssistProvider({
      engine: createEngine(),
      references: makeReferences(),
      ontology: makeOntology(),
      registerWebMCP: false,
    });

    const nextDefinition = {
      ...makeDefinition(),
      items: makeDefinition().items.map((item) => (
        item.key === 'organization'
          ? {
            ...item,
            children: item.children.map((child) => (
              child.key === 'ein'
                ? { ...child, label: 'Federal Tax ID' }
                : child
            )),
          }
          : item
      )),
    };
    provider.attach(new FormEngine(nextDefinition as any));

    expect(provider.getFieldHelp('organization.ein').label).toBe('Federal Tax ID');
  });

  it('infers pages from component first, then theme, then definition hints', async () => {
    const parse = async (
      provider: ReturnType<typeof createAssistProvider>,
      name: string,
      input: Record<string, unknown>,
    ) => {
      const result = await provider.invokeTool(name, input);
      expect(result.isError).not.toBe(true);
      return JSON.parse(result.content[0].text);
    };

    const componentProvider = createAssistProvider({
      engine: createEngine(),
      component: makeComponent(),
      theme: makeTheme(),
      registerWebMCP: false,
    });
    const componentPages = await parse(componentProvider, 'formspec.form.pages', {});
    expect(componentPages.pages.map((page: { id: string; title?: string }) => [page.id, page.title])).toEqual([
      ['component-contact', 'Component Contact'],
      ['component-org', 'Component Organization'],
      ['component-review', 'Review'],
    ]);
    const componentNext = await parse(componentProvider, 'formspec.form.nextIncomplete', { scope: 'page' });
    expect(componentNext).toMatchObject({
      pageId: 'component-contact',
      label: 'Component Contact',
      reason: 'required',
    });

    const themeProvider = createAssistProvider({
      engine: createEngine(),
      theme: makeTheme(),
      registerWebMCP: false,
    });
    const themePages = await parse(themeProvider, 'formspec.form.pages', {});
    expect(themePages.pages.map((page: { id: string; title?: string }) => [page.id, page.title])).toEqual([
      ['theme-contact', 'Theme Contact'],
      ['theme-details', 'Theme Details'],
    ]);
    expect(themePages.pages.map((page: { id: string; fieldCount: number }) => [page.id, page.fieldCount])).toEqual([
      ['theme-contact', 1],
      ['theme-details', 1],
    ]);

    const definitionProvider = createAssistProvider({
      engine: createEngine(),
      registerWebMCP: false,
    });
    const definitionPages = await parse(definitionProvider, 'formspec.form.pages', {});
    expect(definitionPages.pages.map((page: { id: string; title?: string }) => [page.id, page.title])).toEqual([
      ['org', undefined],
      ['details', undefined],
    ]);
  });

  it('falls back from invalid component or theme documents instead of trusting them', async () => {
    const parse = async (
      provider: ReturnType<typeof createAssistProvider>,
      name: string,
      input: Record<string, unknown>,
    ) => {
      const result = await provider.invokeTool(name, input);
      expect(result.isError).not.toBe(true);
      return JSON.parse(result.content[0].text);
    };

    const invalidComponentProvider = createAssistProvider({
      engine: createEngine(),
      component: {
        ...makeComponent(),
        targetDefinition: { url: 'https://example.org/forms/other' },
      },
      theme: makeTheme(),
      registerWebMCP: false,
    });

    const invalidComponentPages = await parse(invalidComponentProvider, 'formspec.form.pages', {});
    expect(invalidComponentPages.pages.map((page: { id: string }) => page.id)).toEqual([
      'theme-contact',
      'theme-details',
    ]);

    const invalidThemeProvider = createAssistProvider({
      engine: createEngine(),
      theme: {
        ...makeTheme(),
        targetDefinition: { url: 'https://example.org/forms/grant', compatibleVersions: '^2.0.0' },
      },
      registerWebMCP: false,
    });

    const invalidThemePages = await parse(invalidThemeProvider, 'formspec.form.pages', {});
    expect(invalidThemePages.pages.map((page: { id: string }) => page.id)).toEqual(['org', 'details']);
  });

  it('uses component-tree theme fallback when the component doc has no explicit pages', async () => {
    const provider = createAssistProvider({
      engine: createEngine(),
      component: {
        $formspecComponent: '1.0',
        version: '1.0.0',
        targetDefinition: { url: 'https://example.org/forms/grant' },
        tree: {
          component: 'Stack',
          children: [
            {
              component: 'Stack',
              bind: 'organization',
              children: [{ component: 'TextInput', bind: 'name' }],
            },
          ],
        },
      } as any,
      theme: {
        $formspecTheme: '1.0',
        version: '1.0.0',
        targetDefinition: { url: 'https://example.org/forms/grant' },
        pages: [
          { id: 'theme-org', title: 'Theme Org', regions: [{ key: 'organization' }] },
        ],
      } as any,
      registerWebMCP: false,
    });

    const result = await provider.invokeTool('formspec.form.pages', {});
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(result.content[0].text).pages).toEqual([
      {
        id: 'theme-org',
        title: 'Theme Org',
        fieldCount: 1,
        filledCount: 0,
        complete: false,
      },
    ]);
  });

  it('enforces declared tool input schemas at runtime', async () => {
    const provider = createAssistProvider({
      engine: createEngine(),
      registerWebMCP: false,
    });

    const result = await provider.invokeTool('formspec.profile.match', { unexpected: true });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      code: 'INVALID_VALUE',
      message: expect.stringMatching(/unexpected/i),
    });

    const invalidAudience = await provider.invokeTool('formspec.field.help', {
      path: 'organization.ein',
      audience: 'robot',
    });
    expect(invalidAudience.isError).toBe(true);
    expect(JSON.parse(invalidAudience.content[0].text)).toMatchObject({
      code: 'INVALID_VALUE',
      message: expect.stringMatching(/audience/i),
    });

    const invalidEntries = await provider.invokeTool('formspec.field.bulkSet', {
      entries: [{ value: 'owner@example.org' }],
    });
    expect(invalidEntries.isError).toBe(true);
    expect(JSON.parse(invalidEntries.content[0].text)).toMatchObject({
      code: 'INVALID_VALUE',
      message: expect.stringMatching(/path/i),
    });

    const invalidMatches = await provider.invokeTool('formspec.profile.apply', {
      matches: [{ path: 12, value: 'owner@example.org' }],
    });
    expect(invalidMatches.isError).toBe(true);
    expect(JSON.parse(invalidMatches.content[0].text)).toMatchObject({
      code: 'INVALID_VALUE',
      message: expect.stringMatching(/path/i),
    });

    const invalidValidateMode = await provider.invokeTool('formspec.form.validate', { mode: 'eventual' });
    expect(invalidValidateMode.isError).toBe(true);
    expect(JSON.parse(invalidValidateMode.content[0].text)).toMatchObject({
      code: 'INVALID_VALUE',
      message: expect.stringMatching(/mode/i),
    });

    const invalidScope = await provider.invokeTool('formspec.form.nextIncomplete', { scope: 'sheet' });
    expect(invalidScope.isError).toBe(true);
    expect(JSON.parse(invalidScope.content[0].text)).toMatchObject({
      code: 'INVALID_VALUE',
      message: expect.stringMatching(/scope/i),
    });
  });

  it('reports meaningful page-level nextIncomplete reasons', async () => {
    const provider = createAssistProvider({
      engine: createEngine(),
      theme: makeTheme(),
      registerWebMCP: false,
    });

    const requiredResult = await provider.invokeTool('formspec.form.nextIncomplete', { scope: 'page' });
    expect(requiredResult.isError).not.toBe(true);
    expect(JSON.parse(requiredResult.content[0].text)).toMatchObject({
      pageId: 'theme-contact',
      reason: 'required',
    });

    const engine = createEngine();
    engine.getFieldVM('contactEmail')?.setValue('owner@example.org');
    engine.getFieldVM('organization.name')?.setValue('Acme Foundation');
    engine.getFieldVM('organization.ein')?.setValue('12-3456789');
    const emptyProvider = createAssistProvider({
      engine,
      theme: makeTheme(),
      registerWebMCP: false,
    });
    const emptyResult = await emptyProvider.invokeTool('formspec.form.nextIncomplete', { scope: 'page' });
    expect(emptyResult.isError).not.toBe(true);
    expect(JSON.parse(emptyResult.content[0].text)).toMatchObject({
      pageId: 'theme-details',
      reason: 'empty',
    });

    const completeEngine = createEngine();
    completeEngine.getFieldVM('contactEmail')?.setValue('owner@example.org');
    completeEngine.getFieldVM('organization.name')?.setValue('Acme Foundation');
    completeEngine.getFieldVM('organization.ein')?.setValue('12-3456789');
    completeEngine.getFieldVM('details.summary')?.setValue('Ready to submit');
    const completeProvider = createAssistProvider({
      engine: completeEngine,
      theme: makeTheme(),
      registerWebMCP: false,
    });
    const completeResult = await completeProvider.invokeTool('formspec.form.nextIncomplete', { scope: 'page' });
    expect(completeResult.isError).not.toBe(true);
    expect(JSON.parse(completeResult.content[0].text)).toEqual({
      label: 'Complete',
    });
  });

  it('emits a discovery event when tools are registered', () => {
    const events: Array<{ type: string; detail: Record<string, unknown> }> = [];
    const previousDocument = (globalThis as Record<string, unknown>).document;
    const previousCustomEvent = (globalThis as Record<string, unknown>).CustomEvent;
    const previousModelContext = (globalThis as Record<string, unknown>).modelContext;

    class FakeCustomEvent<T> {
      public type: string;
      public detail: T;

      public constructor(type: string, init?: { detail?: T }) {
        this.type = type;
        this.detail = (init?.detail ?? {}) as T;
      }
    }

    (globalThis as Record<string, unknown>).document = {
      dispatchEvent(event: { type: string; detail: Record<string, unknown> }) {
        events.push(event);
        return true;
      },
    };
    (globalThis as Record<string, unknown>).CustomEvent = FakeCustomEvent;
    delete (globalThis as Record<string, unknown>).modelContext;

    try {
      const provider = createAssistProvider({
        engine: createEngine(),
      });
      provider.dispose();
    } finally {
      if (previousDocument === undefined) {
        delete (globalThis as Record<string, unknown>).document;
      } else {
        (globalThis as Record<string, unknown>).document = previousDocument;
      }
      if (previousCustomEvent === undefined) {
        delete (globalThis as Record<string, unknown>).CustomEvent;
      } else {
        (globalThis as Record<string, unknown>).CustomEvent = previousCustomEvent;
      }
      if (previousModelContext === undefined) {
        delete (globalThis as Record<string, unknown>).modelContext;
      } else {
        (globalThis as Record<string, unknown>).modelContext = previousModelContext;
      }
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'formspec-tools-available',
      detail: {
        definitionUrl: 'https://example.org/forms/grant',
      },
    });
    expect(events[0].detail.tools).toContain('formspec.field.help');
  });

  it('re-emits discovery metadata when attaching a new engine', () => {
    const events: Array<{ type: string; detail: Record<string, unknown> }> = [];
    const previousDocument = (globalThis as Record<string, unknown>).document;
    const previousCustomEvent = (globalThis as Record<string, unknown>).CustomEvent;
    const previousModelContext = (globalThis as Record<string, unknown>).modelContext;

    class FakeCustomEvent<T> {
      public type: string;
      public detail: T;

      public constructor(type: string, init?: { detail?: T }) {
        this.type = type;
        this.detail = (init?.detail ?? {}) as T;
      }
    }

    (globalThis as Record<string, unknown>).document = {
      dispatchEvent(event: { type: string; detail: Record<string, unknown> }) {
        events.push(event);
        return true;
      },
    };
    (globalThis as Record<string, unknown>).CustomEvent = FakeCustomEvent;
    delete (globalThis as Record<string, unknown>).modelContext;

    try {
      const provider = createAssistProvider({
        engine: createEngine(),
      });
      const nextDefinition = {
        ...makeDefinition(),
        url: 'https://example.org/forms/grant-v2',
      };
      provider.attach(new FormEngine(nextDefinition as any));
      provider.dispose();
    } finally {
      if (previousDocument === undefined) {
        delete (globalThis as Record<string, unknown>).document;
      } else {
        (globalThis as Record<string, unknown>).document = previousDocument;
      }
      if (previousCustomEvent === undefined) {
        delete (globalThis as Record<string, unknown>).CustomEvent;
      } else {
        (globalThis as Record<string, unknown>).CustomEvent = previousCustomEvent;
      }
      if (previousModelContext === undefined) {
        delete (globalThis as Record<string, unknown>).modelContext;
      } else {
        (globalThis as Record<string, unknown>).modelContext = previousModelContext;
      }
    }

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      type: 'formspec-tools-available',
      detail: {
        definitionUrl: 'https://example.org/forms/grant-v2',
      },
    });
  });

  it('does not emit discovery metadata on attach when WebMCP registration is disabled', () => {
    const events: Array<{ type: string; detail: Record<string, unknown> }> = [];
    const previousDocument = (globalThis as Record<string, unknown>).document;
    const previousCustomEvent = (globalThis as Record<string, unknown>).CustomEvent;

    class FakeCustomEvent<T> {
      public type: string;
      public detail: T;

      public constructor(type: string, init?: { detail?: T }) {
        this.type = type;
        this.detail = (init?.detail ?? {}) as T;
      }
    }

    (globalThis as Record<string, unknown>).document = {
      dispatchEvent(event: { type: string; detail: Record<string, unknown> }) {
        events.push(event);
        return true;
      },
    };
    (globalThis as Record<string, unknown>).CustomEvent = FakeCustomEvent;

    try {
      const provider = createAssistProvider({
        engine: createEngine(),
        registerWebMCP: false,
      });
      provider.attach(createEngine());
      provider.dispose();
    } finally {
      if (previousDocument === undefined) {
        delete (globalThis as Record<string, unknown>).document;
      } else {
        (globalThis as Record<string, unknown>).document = previousDocument;
      }
      if (previousCustomEvent === undefined) {
        delete (globalThis as Record<string, unknown>).CustomEvent;
      } else {
        (globalThis as Record<string, unknown>).CustomEvent = previousCustomEvent;
      }
    }

    expect(events).toHaveLength(0);
  });
});
