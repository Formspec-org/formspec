import { describe, it, expect } from 'vitest';
import { ChatSession } from '../src/chat-session.js';
import { MockAdapter } from '../src/mock-adapter.js';
import { SessionStore } from '../src/session-store.js';
import { TemplateLibrary } from '../src/template-library.js';
import type { StorageBackend } from '../src/types.js';

class MemoryStorage implements StorageBackend {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

describe('Integration: full conversation flow', () => {
  it('template → refine → export → save → restore → continue', async () => {
    const adapter = new MockAdapter();
    const storage = new MemoryStorage();
    const store = new SessionStore(storage);

    // 1. Start from template
    const session = new ChatSession({ adapter });
    await session.startFromTemplate('grant-application');

    expect(session.hasDefinition()).toBe(true);
    expect(session.getDefinition()!.title).toMatch(/grant/i);
    expect(session.getTraces().length).toBeGreaterThan(0);

    // 2. Refine via chat
    await session.sendMessage('Add a field for project timeline');
    expect(session.getMessages().length).toBeGreaterThanOrEqual(2);

    // 3. Export
    const exported = session.exportJSON();
    expect(exported.$formspec).toBe('1.0');

    // 4. Save to store
    store.save(session.toState());
    const summaries = store.list();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe(session.id);

    // 5. Restore from store
    const loaded = store.load(session.id)!;
    const restored = ChatSession.fromState(loaded, adapter);
    expect(restored.getMessages()).toEqual(session.getMessages());
    expect(restored.getTraces()).toEqual(session.getTraces());
    expect(restored.hasDefinition()).toBe(true);

    // 6. Continue conversation on restored session
    await restored.sendMessage('Make the budget section optional');
    expect(restored.getMessages().length).toBeGreaterThan(session.getMessages().length);
  });

  it('blank start → interview → scaffold → refine → issues', async () => {
    const adapter = new MockAdapter();
    const session = new ChatSession({ adapter });

    // Interview phase — no definition yet
    await session.sendMessage('I need a form');
    expect(session.hasDefinition()).toBe(false);

    // Scaffold explicitly
    await session.scaffold();
    expect(session.hasDefinition()).toBe(true);
    expect(session.getOpenIssueCount()).toBeGreaterThan(0);

    // Refine after scaffolding
    await session.sendMessage('It should collect name, email, and phone');
    // Issues from the deterministic adapter about needing AI
    const issues = session.getIssues();
    expect(issues.some(i => i.category === 'missing-config')).toBe(true);
  });

  it('all 5 templates can be started and exported', async () => {
    const adapter = new MockAdapter();
    const library = new TemplateLibrary();

    for (const template of library.getAll()) {
      const session = new ChatSession({ adapter });
      await session.startFromTemplate(template.id);

      expect(session.hasDefinition()).toBe(true);
      const def = session.exportJSON();
      expect(def.$formspec).toBe('1.0');
      expect(def.items.length).toBeGreaterThan(0);
      expect(session.getTraces().length).toBeGreaterThan(0);
    }
  });
});

describe('Integration: session store with multiple sessions', () => {
  it('manages multiple independent sessions', async () => {
    const adapter = new MockAdapter();
    const storage = new MemoryStorage();
    const store = new SessionStore(storage);

    const s1 = new ChatSession({ adapter });
    await s1.startFromTemplate('housing-intake');
    store.save(s1.toState());

    const s2 = new ChatSession({ adapter });
    await s2.startFromTemplate('patient-intake');
    store.save(s2.toState());

    const s3 = new ChatSession({ adapter });
    await s3.startFromTemplate('employee-onboarding');
    store.save(s3.toState());

    expect(store.list()).toHaveLength(3);

    // Delete one
    store.delete(s2.id);
    expect(store.list()).toHaveLength(2);

    // Others still loadable
    expect(store.load(s1.id)).not.toBeNull();
    expect(store.load(s3.id)).not.toBeNull();
    expect(store.load(s2.id)).toBeNull();
  });
});

describe('Integration: issue lifecycle', () => {
  it('issues persist through save/restore', async () => {
    const adapter = new MockAdapter();
    const session = new ChatSession({ adapter });

    await session.sendMessage('I need a form');
    await session.scaffold();
    const issuesBefore = session.getIssues();
    expect(issuesBefore.length).toBeGreaterThan(0);

    // Resolve one
    session.resolveIssue(issuesBefore[0].id);

    // Save and restore
    const state = session.toState();
    const restored = ChatSession.fromState(state, adapter);

    const issuesAfter = restored.getIssues();
    expect(issuesAfter).toEqual(session.getIssues());
    expect(issuesAfter.find(i => i.id === issuesBefore[0].id)!.status).toBe('resolved');
  });
});

describe('Integration: bundle generation flow', () => {
  it('template → refine produces updated bundle with component tree', async () => {
    const adapter = new MockAdapter();
    const session = new ChatSession({ adapter });

    await session.startFromTemplate('grant-application');
    const bundle1 = session.getBundle()!;
    expect(bundle1.component.tree).not.toBeNull();
    expect(bundle1.theme).toBeDefined();
    expect(bundle1.mapping).toBeDefined();

    await session.sendMessage('Add a budget section');
    const bundle2 = session.getBundle()!;
    expect(bundle2.component.tree).not.toBeNull();
  });

  it('bundle persists through save/restore cycle', async () => {
    const adapter = new MockAdapter();
    const storage = new MemoryStorage();
    const store = new SessionStore(storage);

    const session = new ChatSession({ adapter });
    await session.startFromTemplate('housing-intake');

    store.save(session.toState());
    const loaded = store.load(session.id)!;
    const restored = ChatSession.fromState(loaded, adapter);

    const bundle = restored.getBundle()!;
    expect(bundle.definition.title).toBe(session.getDefinition()!.title);
    expect(bundle.component).toBeDefined();
    expect(bundle.component.tree).not.toBeNull();
  });

  it('exportBundle returns complete bundle for all templates', async () => {
    const adapter = new MockAdapter();
    const library = new TemplateLibrary();

    for (const template of library.getAll()) {
      const session = new ChatSession({ adapter });
      await session.startFromTemplate(template.id);

      const bundle = session.exportBundle();
      expect(bundle.definition.$formspec).toBe('1.0');
      expect(bundle.component).toBeDefined();
      expect(bundle.theme).toBeDefined();
      expect(bundle.mapping).toBeDefined();
    }
  });
});

describe('Integration: mock adapter keyword matching on scaffold', () => {
  it('matches housing keywords to housing template on scaffold', async () => {
    const adapter = new MockAdapter();
    const session = new ChatSession({ adapter });

    await session.sendMessage('I need a housing application for tenants');
    await session.scaffold();

    const def = session.getDefinition()!;
    // Should match to housing template
    expect(def.items.length).toBeGreaterThan(2);
  });

  it('matches medical keywords to patient template on scaffold', async () => {
    const adapter = new MockAdapter();
    const session = new ChatSession({ adapter });

    await session.sendMessage('We need a patient medical intake form');
    await session.scaffold();

    const def = session.getDefinition()!;
    expect(def.items.length).toBeGreaterThan(2);
  });

  it('matches grant keywords to grant template on scaffold', async () => {
    const adapter = new MockAdapter();
    const session = new ChatSession({ adapter });

    await session.sendMessage('Create a grant application with budget tracking');
    await session.scaffold();

    const def = session.getDefinition()!;
    expect(def.items.length).toBeGreaterThan(2);
  });
});
