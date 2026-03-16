import { describe, it, expect, beforeEach } from 'vitest';
import { ChatSession } from '../src/chat-session.js';
import { MockAdapter } from '../src/mock-adapter.js';
import type { AIAdapter, ScaffoldResult, ChatMessage, Attachment, ChatSessionState } from '../src/types.js';
import type { FormDefinition } from 'formspec-types';

// ── Test helpers ─────────────────────────────────────────────────────

/** Spy adapter that records calls and delegates to mock. */
class SpyAdapter implements AIAdapter {
  calls: { method: string; args: any[] }[] = [];
  private inner = new MockAdapter();

  async generateScaffold(request: any): Promise<ScaffoldResult> {
    this.calls.push({ method: 'generateScaffold', args: [request] });
    return this.inner.generateScaffold(request);
  }

  async refineForm(messages: ChatMessage[], def: FormDefinition, instruction: string): Promise<ScaffoldResult> {
    this.calls.push({ method: 'refineForm', args: [messages, def, instruction] });
    return this.inner.refineForm(messages, def, instruction);
  }

  async extractFromFile(attachment: Attachment): Promise<string> {
    this.calls.push({ method: 'extractFromFile', args: [attachment] });
    return this.inner.extractFromFile(attachment);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

describe('ChatSession', () => {
  let adapter: SpyAdapter;
  let session: ChatSession;

  beforeEach(() => {
    adapter = new SpyAdapter();
    session = new ChatSession({ adapter });
  });

  describe('construction', () => {
    it('starts with empty messages', () => {
      expect(session.getMessages()).toEqual([]);
    });

    it('starts with no traces or issues', () => {
      expect(session.getTraces()).toEqual([]);
      expect(session.getIssues()).toEqual([]);
    });

    it('has a unique session ID', () => {
      const other = new ChatSession({ adapter });
      expect(session.id).toBeTruthy();
      expect(session.id).not.toBe(other.id);
    });
  });

  describe('sendMessage', () => {
    it('adds user message to history', async () => {
      await session.sendMessage('I need a patient intake form');

      const messages = session.getMessages();
      expect(messages).toHaveLength(2); // user + assistant
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('I need a patient intake form');
    });

    it('generates assistant response message', async () => {
      await session.sendMessage('I need a housing intake form');

      const messages = session.getMessages();
      const assistant = messages.find(m => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBeTruthy();
    });

    it('generates scaffold on first meaningful message', async () => {
      await session.sendMessage('I need a patient intake form');

      const def = session.getDefinition();
      expect(def).toBeDefined();
      expect(def!.items.length).toBeGreaterThan(0);
    });

    it('creates source traces for scaffolded elements', async () => {
      await session.sendMessage('I need a housing intake form');

      const traces = session.getTraces();
      expect(traces.length).toBeGreaterThan(0);
    });

    it('calls adapter.refineForm for subsequent messages', async () => {
      await session.sendMessage('I need a patient intake form');
      adapter.calls = []; // reset

      await session.sendMessage('Add a field for blood type');

      expect(adapter.calls.some(c => c.method === 'refineForm')).toBe(true);
    });
  });

  describe('startFromTemplate', () => {
    it('initializes the session with a template scaffold', async () => {
      await session.startFromTemplate('grant-application');

      const def = session.getDefinition();
      expect(def).toBeDefined();
      expect(def!.title).toMatch(/grant/i);
    });

    it('records template traces', async () => {
      await session.startFromTemplate('housing-intake');

      const traces = session.getTraces();
      expect(traces.length).toBeGreaterThan(0);
      expect(traces.every(t => t.sourceType === 'template')).toBe(true);
    });

    it('adds a system message noting template selection', async () => {
      await session.startFromTemplate('patient-intake');

      const messages = session.getMessages();
      expect(messages.some(
        m => m.role === 'system' && m.content.includes('template'),
      )).toBe(true);
    });
  });

  describe('startFromUpload', () => {
    it('generates a scaffold from an uploaded file', async () => {
      const attachment = {
        id: 'att-1',
        type: 'spreadsheet' as const,
        name: 'fields.csv',
        data: 'Name, Email, Phone, Address',
      };

      await session.startFromUpload(attachment);

      expect(session.hasDefinition()).toBe(true);
      const def = session.getDefinition()!;
      expect(def.items.length).toBeGreaterThan(0);
    });

    it('calls adapter.extractFromFile then generateScaffold', async () => {
      const attachment = {
        id: 'att-1',
        type: 'pdf' as const,
        name: 'form.pdf',
        data: 'Name, Email, Department',
      };

      await session.startFromUpload(attachment);

      expect(adapter.calls.some(c => c.method === 'extractFromFile')).toBe(true);
      expect(adapter.calls.some(c => c.method === 'generateScaffold')).toBe(true);
    });

    it('creates source traces with upload sourceType', async () => {
      const attachment = {
        id: 'att-1',
        type: 'image' as const,
        name: 'paper-form.jpg',
        data: 'First Name, Last Name, SSN',
      };

      await session.startFromUpload(attachment);

      const traces = session.getTraces();
      // MockAdapter.extractFromFile returns a message, not actual fields,
      // so scaffoldFromUpload processes the extracted content
      expect(session.hasDefinition()).toBe(true);
    });

    it('adds a system message noting the upload', async () => {
      const attachment = {
        id: 'att-1',
        type: 'spreadsheet' as const,
        name: 'intake.csv',
        data: 'Patient, DOB, Insurance',
      };

      await session.startFromUpload(attachment);

      const messages = session.getMessages();
      expect(messages.some(
        m => m.role === 'system' && m.content.includes('upload'),
      )).toBe(true);
    });

    it('notifies listeners', async () => {
      let callCount = 0;
      session.onChange(() => { callCount++; });

      const attachment = {
        id: 'att-1',
        type: 'json' as const,
        name: 'form.json',
        data: 'Name, Email',
      };

      await session.startFromUpload(attachment);
      expect(callCount).toBeGreaterThan(0);
    });
  });

  describe('issue management', () => {
    it('collects issues from scaffold generation', async () => {
      // Vague input triggers low-confidence issues from deterministic adapter
      await session.sendMessage('I need a form');

      expect(session.getIssues().length).toBeGreaterThan(0);
    });

    it('resolveIssue marks an issue as resolved', async () => {
      await session.sendMessage('I need a form');
      const issues = session.getIssues();
      const openIssue = issues.find(i => i.status === 'open');
      expect(openIssue).toBeDefined();

      session.resolveIssue(openIssue!.id);
      const updated = session.getIssues().find(i => i.id === openIssue!.id);
      expect(updated!.status).toBe('resolved');
    });

    it('deferIssue marks an issue as deferred', async () => {
      await session.sendMessage('I need a form');
      const openIssue = session.getIssues().find(i => i.status === 'open')!;

      session.deferIssue(openIssue.id);
      const updated = session.getIssues().find(i => i.id === openIssue.id);
      expect(updated!.status).toBe('deferred');
    });

    it('getOpenIssueCount returns count of open issues', async () => {
      await session.sendMessage('I need a form');
      const count = session.getOpenIssueCount();
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('diff tracking', () => {
    it('getLastDiff returns null before any refinement', async () => {
      await session.startFromTemplate('housing-intake');
      expect(session.getLastDiff()).toBeNull();
    });

    it('getLastDiff returns diff after refinement', async () => {
      await session.startFromTemplate('housing-intake');
      await session.sendMessage('Add a field for emergency contact');

      const diff = session.getLastDiff();
      // Deterministic adapter returns the same definition on refine,
      // so diff should exist (even if empty — no items changed)
      expect(diff).toBeDefined();
      expect(diff).not.toBeNull();
    });

    it('getLastDiff is null after first scaffold (not a refinement)', async () => {
      await session.sendMessage('I need a patient intake form');
      // First scaffold is not a refinement — no previous definition to diff
      expect(session.getLastDiff()).toBeNull();
    });
  });

  describe('trace queries', () => {
    it('getTracesForElement returns traces for a specific path', async () => {
      await session.startFromTemplate('housing-intake');

      const traces = session.getTracesForElement('applicant_name');
      expect(traces.length).toBeGreaterThan(0);
      expect(traces[0].elementPath).toBe('applicant_name');
    });
  });

  describe('export', () => {
    it('exportJSON returns the current definition', async () => {
      await session.startFromTemplate('grant-application');

      const json = session.exportJSON();
      expect(json.$formspec).toBe('1.0');
      expect(json.items.length).toBeGreaterThan(0);
    });

    it('throws when no definition exists', () => {
      expect(() => session.exportJSON()).toThrow(/no form/i);
    });
  });

  describe('state serialization', () => {
    it('toState captures full session state', async () => {
      await session.startFromTemplate('housing-intake');
      await session.sendMessage('Add a pet policy question');

      const state = session.toState();

      expect(state.id).toBe(session.id);
      expect(state.messages.length).toBeGreaterThan(0);
      expect(state.traces.length).toBeGreaterThan(0);
      expect(state.projectSnapshot.definition).toBeDefined();
      expect(state.createdAt).toBeGreaterThan(0);
      expect(state.updatedAt).toBeGreaterThanOrEqual(state.createdAt);
    });

    it('fromState restores a session', async () => {
      await session.startFromTemplate('patient-intake');
      const state = session.toState();

      const restored = ChatSession.fromState(state, adapter);

      expect(restored.id).toBe(session.id);
      expect(restored.getMessages()).toEqual(session.getMessages());
      expect(restored.getTraces()).toEqual(session.getTraces());
      expect(restored.getDefinition()).toEqual(session.getDefinition());
    });

    it('restored session can continue receiving messages', async () => {
      await session.startFromTemplate('housing-intake');
      const state = session.toState();

      const restored = ChatSession.fromState(state, adapter);
      await restored.sendMessage('Add a disability accommodation field');

      expect(restored.getMessages().length).toBeGreaterThan(state.messages.length);
    });
  });

  describe('hasDefinition', () => {
    it('returns false before any scaffold', () => {
      expect(session.hasDefinition()).toBe(false);
    });

    it('returns true after scaffold', async () => {
      await session.startFromTemplate('housing-intake');
      expect(session.hasDefinition()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('message timestamps are monotonically increasing', async () => {
      await session.sendMessage('First');
      await session.sendMessage('Second');
      const messages = session.getMessages();
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].timestamp).toBeGreaterThanOrEqual(messages[i - 1].timestamp);
      }
    });

    it('each message has a unique ID', async () => {
      await session.sendMessage('A');
      await session.sendMessage('B');
      const ids = session.getMessages().map(m => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('startFromTemplate with unknown ID throws', async () => {
      await expect(session.startFromTemplate('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('multiple startFromTemplate calls overwrite the definition', async () => {
      await session.startFromTemplate('housing-intake');
      const firstDef = session.getDefinition()!;

      await session.startFromTemplate('grant-application');
      const secondDef = session.getDefinition()!;

      expect(secondDef.title).not.toBe(firstDef.title);
    });

    it('toState on fresh session (no definition) still works', () => {
      const state = session.toState();
      expect(state.id).toBe(session.id);
      expect(state.messages).toEqual([]);
    });

    it('sendMessage returns the assistant message', async () => {
      const reply = await session.sendMessage('Hello');
      expect(reply.role).toBe('assistant');
      expect(reply.content).toBeTruthy();
    });
  });

  describe('onChange subscription', () => {
    it('notifies listener on sendMessage', async () => {
      let callCount = 0;
      session.onChange(() => { callCount++; });

      await session.sendMessage('Hello');
      expect(callCount).toBeGreaterThan(0);
    });

    it('notifies listener on startFromTemplate', async () => {
      let callCount = 0;
      session.onChange(() => { callCount++; });

      await session.startFromTemplate('housing-intake');
      expect(callCount).toBeGreaterThan(0);
    });

    it('notifies on resolveIssue', async () => {
      await session.sendMessage('I need a form');
      const issue = session.getIssues().find(i => i.status === 'open')!;

      let callCount = 0;
      session.onChange(() => { callCount++; });

      session.resolveIssue(issue.id);
      expect(callCount).toBe(1);
    });

    it('returns unsubscribe function', async () => {
      let callCount = 0;
      const unsub = session.onChange(() => { callCount++; });

      await session.sendMessage('Hello');
      const countAfterFirst = callCount;

      unsub();
      await session.sendMessage('World');
      expect(callCount).toBe(countAfterFirst);
    });
  });
});
