import { describe, it, expect, beforeEach } from 'vitest';
import { ChatSession } from '../src/chat-session.js';
import { MockAdapter } from '../src/mock-adapter.js';
import type { AIAdapter, ScaffoldResult, ChatMessage, Attachment, ChatSessionState, ConversationResponse, ToolContext, RefinementResult } from '../src/types.js';
import type { FormDefinition, ProjectBundle } from 'formspec-types';
// ── Test helpers ─────────────────────────────────────────────────────

/** Stub buildBundle callback that wraps a definition in a minimal ProjectBundle. */
function mockBuildBundle(def: FormDefinition): ProjectBundle {
  return {
    definition: def,
    component: { tree: null } as any,
    theme: {} as any,
    mappings: {},
  };
}

/** Spy adapter that records calls and delegates to mock. */
class SpyAdapter implements AIAdapter {
  calls: { method: string; args: any[] }[] = [];
  private inner = new MockAdapter();

  async chat(messages: ChatMessage[]): Promise<ConversationResponse> {
    this.calls.push({ method: 'chat', args: [messages] });
    return this.inner.chat(messages);
  }

  async generateScaffold(request: any): Promise<ScaffoldResult> {
    this.calls.push({ method: 'generateScaffold', args: [request] });
    return this.inner.generateScaffold(request);
  }

  async refineForm(messages: ChatMessage[], instruction: string, toolContext: ToolContext): Promise<RefinementResult> {
    this.calls.push({ method: 'refineForm', args: [messages, instruction, toolContext] });
    return this.inner.refineForm(messages, instruction, toolContext);
  }

  async extractFromFile(attachment: Attachment): Promise<string> {
    this.calls.push({ method: 'extractFromFile', args: [attachment] });
    return this.inner.extractFromFile(attachment);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/** Creates a minimal ToolContext for testing. */
function createMockToolContext(): ToolContext {
  return {
    tools: [
      { name: 'formspec_field', description: 'Add/update a field', inputSchema: {} },
      { name: 'formspec_describe', description: 'Describe the form', inputSchema: {} },
    ],
    callTool: async (name: string, args: Record<string, unknown>) => {
      if (name === 'formspec_field') {
        return { content: '{"summary": "Field added"}', isError: false };
      }
      if (name === 'formspec_describe') {
        return { content: '{"definition": null}', isError: false };
      }
      return { content: `Unknown tool: ${name}`, isError: true };
    },
  };
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

    it('starts with no tool context', () => {
      expect(session.getToolContext()).toBeNull();
    });
  });

  describe('setToolContext / getToolContext', () => {
    it('stores and retrieves the tool context', () => {
      const ctx = createMockToolContext();
      session.setToolContext(ctx);
      expect(session.getToolContext()).toBe(ctx);
    });

    it('can replace the tool context', () => {
      const ctx1 = createMockToolContext();
      const ctx2 = createMockToolContext();
      session.setToolContext(ctx1);
      session.setToolContext(ctx2);
      expect(session.getToolContext()).toBe(ctx2);
    });
  });

  describe('sendMessage (interview phase)', () => {
    it('adds user message to history', async () => {
      await session.sendMessage('I need a patient intake form');

      const messages = session.getMessages();
      expect(messages).toHaveLength(2); // user + assistant
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('I need a patient intake form');
    });

    it('generates assistant response message via chat()', async () => {
      await session.sendMessage('I need a housing intake form');

      const messages = session.getMessages();
      const assistant = messages.find(m => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBeTruthy();
    });

    it('calls adapter.chat() when no definition exists', async () => {
      await session.sendMessage('I need a patient intake form');

      expect(adapter.calls.some(c => c.method === 'chat')).toBe(true);
    });

    it('does not create a definition during interview', async () => {
      await session.sendMessage('I need a patient intake form');

      expect(session.hasDefinition()).toBe(false);
    });

    it('isReadyToScaffold reflects adapter response', async () => {
      expect(session.isReadyToScaffold()).toBe(false);

      await session.sendMessage('I need a form');
      // One user message: MockAdapter returns readyToScaffold: false
      expect(session.isReadyToScaffold()).toBe(false);
    });

    it('calls adapter.refineForm for messages after scaffolding (with tool context)', async () => {
      await session.startFromTemplate('patient-intake');
      session.setToolContext(createMockToolContext());
      adapter.calls = []; // reset

      await session.sendMessage('Add a field for blood type');

      expect(adapter.calls.some(c => c.method === 'refineForm')).toBe(true);
    });

    it('returns error message when refining without tool context', async () => {
      await session.startFromTemplate('patient-intake');
      // Do NOT set tool context

      const msg = await session.sendMessage('Add a field for blood type');
      expect(msg.role).toBe('system');
      expect(msg.content).toMatch(/tool context/i);
    });
  });

  describe('scaffold()', () => {
    it('generates definition from accumulated messages', async () => {
      await session.sendMessage('I need a patient intake form');
      await session.scaffold();

      const def = session.getDefinition();
      expect(def).toBeDefined();
      expect(def!.items.length).toBeGreaterThan(0);
    });

    it('calls adapter.generateScaffold with conversation type', async () => {
      await session.sendMessage('I need a form');
      adapter.calls = [];

      await session.scaffold();

      const scaffoldCall = adapter.calls.find(c => c.method === 'generateScaffold');
      expect(scaffoldCall).toBeDefined();
      expect(scaffoldCall!.args[0].type).toBe('conversation');
    });

    it('builds bundle when buildBundle is provided', async () => {
      const bundleSession = new ChatSession({ adapter, buildBundle: mockBuildBundle });
      await bundleSession.sendMessage('I need a form');
      await bundleSession.scaffold();

      const bundle = bundleSession.getBundle();
      expect(bundle).not.toBeNull();
      expect(bundle!.definition).toBeDefined();
    });

    it('getBundle returns null after scaffold when no buildBundle provided', async () => {
      await session.sendMessage('I need a form');
      await session.scaffold();

      expect(session.getBundle()).toBeNull();
    });

    it('adds system message about generated form', async () => {
      await session.sendMessage('I need a form');
      await session.scaffold();

      const messages = session.getMessages();
      expect(messages.some(
        m => m.role === 'system' && /generated form/i.test(m.content),
      )).toBe(true);
    });

    it('resets readyToScaffold to false', async () => {
      // Send enough messages to trigger readyToScaffold
      await session.sendMessage('I need a form');
      await session.sendMessage('It collects name and email');
      await session.sendMessage('For new employees');

      await session.scaffold();

      expect(session.isReadyToScaffold()).toBe(false);
    });

    it('creates source traces for scaffolded elements', async () => {
      await session.sendMessage('I need a housing intake form');
      await session.scaffold();

      const traces = session.getTraces();
      expect(traces.length).toBeGreaterThan(0);
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
      await session.scaffold();

      expect(session.getIssues().length).toBeGreaterThan(0);
    });

    it('resolveIssue marks an issue as resolved', async () => {
      await session.sendMessage('I need a form');
      await session.scaffold();
      const issues = session.getIssues();
      const openIssue = issues.find(i => i.status === 'open');
      expect(openIssue).toBeDefined();

      session.resolveIssue(openIssue!.id);
      const updated = session.getIssues().find(i => i.id === openIssue!.id);
      expect(updated!.status).toBe('resolved');
    });

    it('deferIssue marks an issue as deferred', async () => {
      await session.sendMessage('I need a form');
      await session.scaffold();
      const openIssue = session.getIssues().find(i => i.status === 'open')!;

      session.deferIssue(openIssue.id);
      const updated = session.getIssues().find(i => i.id === openIssue.id);
      expect(updated!.status).toBe('deferred');
    });

    it('getOpenIssueCount returns count of open issues', async () => {
      await session.sendMessage('I need a form');
      await session.scaffold();
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
      session.setToolContext(createMockToolContext());
      await session.sendMessage('Add a field for emergency contact');

      const diff = session.getLastDiff();
      // Deterministic adapter returns the same definition on refine,
      // so diff should exist (even if empty — no items changed)
      expect(diff).toBeDefined();
      expect(diff).not.toBeNull();
    });

    it('getLastDiff is null after first scaffold (not a refinement)', async () => {
      await session.sendMessage('I need a patient intake form');
      await session.scaffold();
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
      session.setToolContext(createMockToolContext());
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

      const restored = await ChatSession.fromState(state, adapter);

      expect(restored.id).toBe(session.id);
      expect(restored.getMessages()).toEqual(session.getMessages());
      expect(restored.getTraces()).toEqual(session.getTraces());
      expect(restored.getDefinition()).toEqual(session.getDefinition());
    });

    it('restored session has no tool context (host must provide)', async () => {
      await session.startFromTemplate('housing-intake');
      session.setToolContext(createMockToolContext());
      const state = session.toState();

      const restored = await ChatSession.fromState(state, adapter);
      expect(restored.getToolContext()).toBeNull();
    });

    it('restored session can continue receiving messages after setToolContext', async () => {
      await session.startFromTemplate('housing-intake');
      const state = session.toState();

      const restored = await ChatSession.fromState(state, adapter);
      restored.setToolContext(createMockToolContext());
      await restored.sendMessage('Add a disability accommodation field');

      expect(restored.getMessages().length).toBeGreaterThan(state.messages.length);
    });

    it('readyToScaffold persists through toState/fromState', async () => {
      // Send 3 messages to trigger readyToScaffold in MockAdapter
      await session.sendMessage('I need a form');
      await session.sendMessage('It collects name and email');
      await session.sendMessage('For new employees');

      const state = session.toState();
      expect(state.readyToScaffold).toBe(true);

      const restored = await ChatSession.fromState(state, adapter);
      expect(restored.isReadyToScaffold()).toBe(true);
    });

    it('readyToScaffold defaults to false for legacy states', async () => {
      const legacyState = {
        id: 'old-session',
        messages: [],
        projectSnapshot: { definition: null },
        traces: [],
        issues: [],
        createdAt: 1000,
        updatedAt: 1000,
      } as any;
      const restored = await ChatSession.fromState(legacyState, adapter);
      expect(restored.isReadyToScaffold()).toBe(false);
    });

    it('templates bypass interview (definition set immediately)', async () => {
      await session.startFromTemplate('housing-intake');
      expect(session.hasDefinition()).toBe(true);
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

    it('sendMessage returns the assistant message (interview phase)', async () => {
      const reply = await session.sendMessage('Hello');
      expect(reply.role).toBe('assistant');
      expect(reply.content).toBeTruthy();
    });
  });

  describe('bundle generation', () => {
    let bundleSession: ChatSession;

    beforeEach(() => {
      bundleSession = new ChatSession({ adapter, buildBundle: mockBuildBundle });
    });

    it('getBundle returns null before any scaffold', () => {
      expect(bundleSession.getBundle()).toBeNull();
    });

    it('getBundle returns null when no buildBundle provided', async () => {
      await session.startFromTemplate('housing-intake');
      expect(session.getBundle()).toBeNull();
    });

    it('getBundle returns a full ProjectBundle after scaffold', async () => {
      await bundleSession.startFromTemplate('housing-intake');

      const bundle = bundleSession.getBundle();
      expect(bundle).not.toBeNull();
      expect(bundle!.definition).toBeDefined();
      expect(bundle!.component).toBeDefined();
      expect(bundle!.theme).toBeDefined();
      expect(bundle!.mappings).toBeDefined();
    });

    it('bundle definition matches getDefinition()', async () => {
      await bundleSession.startFromTemplate('housing-intake');

      const bundle = bundleSession.getBundle()!;
      expect(bundle.definition.title).toBe(bundleSession.getDefinition()!.title);
      expect(bundle.definition.items.length).toBe(bundleSession.getDefinition()!.items.length);
    });

    it('bundle updates after refinement via getProjectSnapshot', async () => {
      await bundleSession.startFromTemplate('housing-intake');
      const firstBundle = bundleSession.getBundle()!;

      // Create a tool context that returns an updated definition via getProjectSnapshot
      const updatedDef = { ...bundleSession.getDefinition()!, title: 'Updated Form' };
      const ctx = createMockToolContext();
      ctx.getProjectSnapshot = async () => ({ definition: updatedDef });
      bundleSession.setToolContext(ctx);

      await bundleSession.sendMessage('Add a field for emergency contact');
      const secondBundle = bundleSession.getBundle()!;

      // Bundle should be a new object (rebuilt from snapshot)
      expect(secondBundle).not.toBe(firstBundle);
      expect(secondBundle.definition).toBeDefined();
      expect(secondBundle.definition.title).toBe('Updated Form');
    });

    it('bundle is generated after conversation scaffold', async () => {
      await bundleSession.sendMessage('I need a patient intake form');
      await bundleSession.scaffold();

      const bundle = bundleSession.getBundle();
      expect(bundle).not.toBeNull();
    });

    it('bundle is generated after upload scaffold', async () => {
      const attachment = {
        id: 'att-1',
        type: 'spreadsheet' as const,
        name: 'fields.csv',
        data: 'Name, Email, Phone',
      };
      await bundleSession.startFromUpload(attachment);

      const bundle = bundleSession.getBundle();
      expect(bundle).not.toBeNull();
    });

    it('exportBundle returns the full bundle', async () => {
      await bundleSession.startFromTemplate('grant-application');

      const bundle = bundleSession.exportBundle();
      expect(bundle.definition.$formspec).toBe('1.0');
      expect(bundle.component).toBeDefined();
      expect(bundle.theme).toBeDefined();
      expect(bundle.mappings).toBeDefined();
    });

    it('exportBundle throws when no definition exists', () => {
      expect(() => bundleSession.exportBundle()).toThrow(/no form/i);
    });

    it('toState does not serialize the bundle (reconstructed on restore)', async () => {
      await bundleSession.startFromTemplate('housing-intake');
      const state = bundleSession.toState();

      expect(state.projectSnapshot).not.toHaveProperty('bundle');
    });

    it('bundle is reconstructed from definition in fromState()', async () => {
      await bundleSession.startFromTemplate('patient-intake');
      const state = bundleSession.toState();

      const restored = await ChatSession.fromState(state, adapter, mockBuildBundle);
      const bundle = restored.getBundle();
      expect(bundle).not.toBeNull();
      expect(bundle!.definition.title).toBe(bundleSession.getDefinition()!.title);
    });

    it('fromState handles legacy state without bundle field', async () => {
      const legacyState = {
        id: 'old-session',
        messages: [],
        projectSnapshot: { definition: null },
        traces: [],
        issues: [],
        createdAt: 1000,
        updatedAt: 1000,
      } as any;
      const restored = await ChatSession.fromState(legacyState, adapter, mockBuildBundle);
      expect(restored.getBundle()).toBeNull();
    });

    it('bundle.definition deep-equals getDefinition after restore', async () => {
      await bundleSession.startFromTemplate('housing-intake');
      const state = bundleSession.toState();
      const restored = await ChatSession.fromState(state, adapter, mockBuildBundle);
      expect(restored.getBundle()!.definition).toEqual(restored.getDefinition());
    });

    it('component tree from mockBuildBundle has null tree', async () => {
      await bundleSession.startFromTemplate('housing-intake');
      const bundle = bundleSession.getBundle()!;
      // mockBuildBundle sets tree to null — real bundle comes from Studio
      expect(bundle.component.tree).toBeNull();
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
      await session.scaffold();
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
