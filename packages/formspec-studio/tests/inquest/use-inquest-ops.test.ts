/**
 * Unit tests for useInquestOps hook.
 *
 * Tests the state machine behaviors of the core AI operations hook:
 * - handleAnalyze early-return guards (empty input vs template-only)
 * - Error handling when providers fail
 * - Error dismiss behavior
 *
 * Uses renderHook to test hook logic in isolation, with a controlled
 * mock provider to deterministically control success/failure.
 */

import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInquestOps } from '../../src/inquest-app/hooks/useInquestOps';
import type {
  InquestProviderAdapter,
  InquestSessionV1,
  InquestTemplate,
} from '../../src/shared/contracts/inquest';
import { buildAnalysis, buildProposal } from '../../src/shared/providers';
import { InquestDraft } from '../../src/shared/authoring/inquest-draft';

/* ── Fixtures ────────────────────────────────────── */

function makeSession(overrides: Partial<InquestSessionV1> = {}): InquestSessionV1 {
  return {
    version: 1,
    sessionId: 'sess-1',
    title: 'Test Session',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phase: 'inputs',
    mode: 'new-project',
    workflowMode: 'verify-carefully',
    input: {
      description: '',
      uploads: [],
      messages: [],
      templateId: undefined,
    },
    issues: [],
    ...overrides,
  };
}

function makeProvider(overrides: Partial<InquestProviderAdapter> = {}): InquestProviderAdapter {
  return {
    id: 'mock',
    label: 'Mock',
    capabilities: { chat: true, images: false, pdf: false, structuredOutput: true, streaming: false },
    testConnection: vi.fn().mockResolvedValue({ ok: true, message: 'OK' }),
    runAnalysis: vi.fn().mockImplementation(async (input) => buildAnalysis(input)),
    runProposal: vi.fn().mockImplementation(async (input) => buildProposal(input)),
    runEdit: vi.fn().mockResolvedValue({ commands: [], issues: [], explanation: '' }),
    ...overrides,
  };
}

/* ── Tests ───────────────────────────────────────── */

describe('useInquestOps — handleAnalyze early-return guard', () => {
  it('does NOT call the provider when description is empty and no template is selected', async () => {
    const provider = makeProvider();
    const session = makeSession({ input: { description: '', uploads: [], messages: [] } });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(provider.runAnalysis).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('DOES call the provider when description is empty but a template is selected', async () => {
    const provider = makeProvider();
    const template: InquestTemplate = {
      id: 'housing-intake',
      name: 'Housing Intake',
      description: 'Test template',
      seedAnalysis: { fields: [{ key: 'name', label: 'Name', dataType: 'string', required: true, sourceIds: ['template'] }], sections: [], rules: [], repeats: [], routes: [] },
    };
    const session = makeSession({
      input: { description: '', uploads: [], messages: [], templateId: 'housing-intake' },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, template, updateSession),
    );

    await act(async () => {
      await result.current.handleAnalyze();
    });

    // Provider should be called with the session and template
    expect(provider.runAnalysis).toHaveBeenCalledOnce();
    // Session should transition to review phase
    expect(updateSession).toHaveBeenCalled();
    const updaterFn = updateSession.mock.calls[0][0];
    const nextSession = updaterFn(session);
    expect(nextSession.phase).toBe('review');
    expect(nextSession.analysis).toBeDefined();
  });

  it('DOES call the provider when description is non-empty (normal flow)', async () => {
    const provider = makeProvider();
    const session = makeSession({
      input: {
        description: 'Build a patient intake form with demographics and medical history',
        uploads: [],
        messages: [],
      },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(provider.runAnalysis).toHaveBeenCalledOnce();
  });
});

describe('useInquestOps — handleAnalyze error handling', () => {
  it('sets operationError when the provider throws', async () => {
    const provider = makeProvider({
      runAnalysis: vi.fn().mockRejectedValue(new Error('Network timeout')),
    });
    const session = makeSession({
      input: {
        description: 'Build a complex intake form with many fields',
        uploads: [],
        messages: [],
      },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    expect(result.current.operationError).toBeNull();

    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(result.current.operationError).toBe('Network timeout');
    // Session should NOT transition (error case)
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('shows a fallback error message when the thrown value is not an Error instance', async () => {
    const provider = makeProvider({
      runAnalysis: vi.fn().mockRejectedValue('string-error'),
    });
    const session = makeSession({
      input: { description: 'Build a grant application form for nonprofits', uploads: [], messages: [] },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(result.current.operationError).toBe('Analysis failed. Please try again.');
  });

  it('resets isAnalyzing to false after analysis completes', async () => {
    const provider = makeProvider({
      runAnalysis: vi.fn().mockImplementation(async (input) => {
        await new Promise((r) => setTimeout(r, 10));
        return buildAnalysis(input);
      }),
    });
    const session = makeSession({
      input: { description: 'Build an event registration form', uploads: [], messages: [] },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    expect(result.current.isAnalyzing).toBe(false);

    // After the full async cycle completes, isAnalyzing resets to false
    await act(async () => {
      await result.current.handleAnalyze();
    });

    expect(result.current.isAnalyzing).toBe(false);
    // And the session was updated (analysis ran)
    expect(updateSession).toHaveBeenCalled();
  });

  it('clears a previous error when analysis is retried and succeeds', async () => {
    const provider = makeProvider({
      runAnalysis: vi.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockImplementationOnce(async (input) => buildAnalysis(input)),
    });
    const session = makeSession({
      input: { description: 'Build a customer survey with NPS and feedback', uploads: [], messages: [] },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    // First attempt fails
    await act(async () => { await result.current.handleAnalyze(); });
    expect(result.current.operationError).toBe('First attempt failed');

    // Second attempt succeeds — error should be cleared
    await act(async () => { await result.current.handleAnalyze(); });
    expect(result.current.operationError).toBeNull();
  });
});

describe('useInquestOps — clearOperationError', () => {
  it('clears the operation error when called', async () => {
    const provider = makeProvider({
      runAnalysis: vi.fn().mockRejectedValue(new Error('Boom')),
    });
    const session = makeSession({
      input: { description: 'Build a screening questionnaire for eligibility', uploads: [], messages: [] },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => { await result.current.handleAnalyze(); });
    expect(result.current.operationError).toBe('Boom');

    act(() => { result.current.clearOperationError(); });
    expect(result.current.operationError).toBeNull();
  });
});

/* ── handleChatNew ────────────────────────────── */

describe('useInquestOps — handleChatNew', () => {
  it('adds the user message to session and triggers analysis', async () => {
    const provider = makeProvider();
    const session = makeSession({
      input: { description: '', uploads: [], messages: [] },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleChatNew('Build a patient intake form with demographics');
    });

    // updateSession should have been called twice:
    // 1. First call: add user message + update description
    // 2. Second call: analysis result → transition to review
    expect(updateSession).toHaveBeenCalledTimes(2);

    // First call adds the message
    const firstUpdater = updateSession.mock.calls[0][0];
    const afterMessage = firstUpdater(session);
    expect(afterMessage.input.description).toBe('Build a patient intake form with demographics');
    expect(afterMessage.input.messages).toHaveLength(1);
    expect(afterMessage.input.messages[0].role).toBe('user');
    expect(afterMessage.input.messages[0].text).toBe('Build a patient intake form with demographics');

    // Second call transitions to review
    const secondUpdater = updateSession.mock.calls[1][0];
    const afterAnalysis = secondUpdater(afterMessage);
    expect(afterAnalysis.phase).toBe('review');
    expect(afterAnalysis.analysis).toBeDefined();
  });

  it('updates the description with the chat message text', async () => {
    const provider = makeProvider();
    const session = makeSession({
      input: { description: 'old description', uploads: [], messages: [] },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleChatNew('New form requirements');
    });

    const firstUpdater = updateSession.mock.calls[0][0];
    const afterMessage = firstUpdater(session);
    // Description should be replaced with the new text
    expect(afterMessage.input.description).toBe('New form requirements');
  });

  it('calls provider.runAnalysis with the chat text as the description', async () => {
    const provider = makeProvider();
    const session = makeSession({
      input: { description: '', uploads: [], messages: [] },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleChatNew('Collect name, email, phone');
    });

    expect(provider.runAnalysis).toHaveBeenCalledOnce();
    // The analysis input should contain the chat text as the description
    const analysisInput = (provider.runAnalysis as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(analysisInput.session.input.description).toBe('Collect name, email, phone');
  });

  it('sets operationError when analysis triggered by chat fails', async () => {
    const provider = makeProvider({
      runAnalysis: vi.fn().mockRejectedValue(new Error('Chat analysis failed')),
    });
    const session = makeSession({
      input: { description: '', uploads: [], messages: [] },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleChatNew('Build a form');
    });

    // The message should still be added (first updateSession call)
    expect(updateSession).toHaveBeenCalledTimes(1);
    // Error should be set
    expect(result.current.operationError).toBe('Chat analysis failed');
  });
});

/* ── handleGenerateProposal ────────────────────── */

describe('useInquestOps — handleGenerateProposal', () => {
  it('runs analysis + proposal and transitions to review with a proposal', async () => {
    const provider = makeProvider();
    const session = makeSession({
      input: { description: 'Build a patient intake form', uploads: [], messages: [], templateId: 'housing-intake' },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleGenerateProposal();
    });

    // Both analysis and proposal should have been called
    expect(provider.runAnalysis).toHaveBeenCalledOnce();
    expect(provider.runProposal).toHaveBeenCalledOnce();
    // Draft should be set
    expect(setDraft).toHaveBeenCalledOnce();
    // Session should transition to review with both analysis and proposal
    expect(updateSession).toHaveBeenCalledOnce();
    const updaterFn = updateSession.mock.calls[0][0];
    const nextSession = updaterFn(session);
    expect(nextSession.phase).toBe('review');
    expect(nextSession.analysis).toBeDefined();
    expect(nextSession.proposal).toBeDefined();
    expect(nextSession.draftBundle).toBeDefined();
  });

  it('reuses existing analysis when session already has one', async () => {
    const existingAnalysis = buildAnalysis({
      session: makeSession({ input: { description: 'test', uploads: [], messages: [] } }),
    });
    const provider = makeProvider();
    const session = makeSession({
      input: { description: 'test', uploads: [], messages: [] },
      analysis: existingAnalysis,
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleGenerateProposal();
    });

    // Should NOT call runAnalysis again (already cached)
    expect(provider.runAnalysis).not.toHaveBeenCalled();
    // Should still call runProposal
    expect(provider.runProposal).toHaveBeenCalledOnce();
  });

  it('sets operationError when proposal generation fails', async () => {
    const provider = makeProvider({
      runProposal: vi.fn().mockRejectedValue(new Error('Proposal API down')),
    });
    const session = makeSession({
      input: { description: 'Build a form', uploads: [], messages: [] },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleGenerateProposal();
    });

    expect(result.current.operationError).toBe('Proposal API down');
    expect(result.current.isAnalyzing).toBe(false);
  });

  it('does nothing when provider is undefined', async () => {
    const session = makeSession({
      input: { description: 'Build a form', uploads: [], messages: [] },
    });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, undefined, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleGenerateProposal();
    });

    expect(updateSession).not.toHaveBeenCalled();
    expect(setDraft).not.toHaveBeenCalled();
  });
});

/* ── handleEnterRefine ─────────────────────────── */

describe('useInquestOps — handleEnterRefine', () => {
  it('transitions to refine phase', () => {
    const provider = makeProvider();
    const session = makeSession({ phase: 'review' });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    act(() => {
      result.current.handleEnterRefine();
    });

    expect(updateSession).toHaveBeenCalledOnce();
    const updaterFn = updateSession.mock.calls[0][0];
    const nextSession = updaterFn(session);
    expect(nextSession.phase).toBe('refine');
  });

  it('creates a draft from proposal when no draft exists', () => {
    const provider = makeProvider();
    const proposal = buildProposal({
      session: makeSession({ input: { description: 'test', uploads: [], messages: [] } }),
      analysis: buildAnalysis({ session: makeSession({ input: { description: 'test', uploads: [], messages: [] } }) }),
    });
    const session = makeSession({ phase: 'review', proposal });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    act(() => {
      result.current.handleEnterRefine();
    });

    // Draft should be created from proposal
    expect(setDraft).toHaveBeenCalledOnce();
    const createdDraft = setDraft.mock.calls[0][0];
    expect(createdDraft).toBeTruthy();
    expect(createdDraft.export).toBeDefined();
  });

  it('does not recreate draft when one already exists', () => {
    const provider = makeProvider();
    const existingDraft = new InquestDraft();
    const session = makeSession({ phase: 'review' });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, existingDraft, setDraft, provider, undefined, updateSession),
    );

    act(() => {
      result.current.handleEnterRefine();
    });

    // setDraft should NOT be called (draft already exists)
    expect(setDraft).not.toHaveBeenCalled();
    // But phase should still change
    expect(updateSession).toHaveBeenCalledOnce();
  });

  it('does nothing when session is null', () => {
    const provider = makeProvider();
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(null, null, setDraft, provider, undefined, updateSession),
    );

    act(() => {
      result.current.handleEnterRefine();
    });

    expect(updateSession).not.toHaveBeenCalled();
  });
});

/* ── handleApplyPrompt ─────────────────────────── */

describe('useInquestOps — handleApplyPrompt', () => {
  it('calls provider.runEdit and updates session when successful', async () => {
    const provider = makeProvider({
      runEdit: vi.fn().mockResolvedValue({
        commands: [],
        issues: [],
        explanation: 'No changes needed',
      }),
    });
    const draft = new InquestDraft();
    const proposal = buildProposal({
      session: makeSession({ input: { description: 'test', uploads: [], messages: [] } }),
      analysis: buildAnalysis({ session: makeSession({ input: { description: 'test', uploads: [], messages: [] } }) }),
    });
    const session = makeSession({ phase: 'refine', proposal });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, draft, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleApplyPrompt('make email required');
    });

    expect(provider.runEdit).toHaveBeenCalledOnce();
    expect(provider.runEdit).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'make email required' }),
    );
    expect(updateSession).toHaveBeenCalledOnce();
  });

  it('sets operationError when runEdit throws', async () => {
    const provider = makeProvider({
      runEdit: vi.fn().mockRejectedValue(new Error('Edit service unavailable')),
    });
    const draft = new InquestDraft();
    const session = makeSession({ phase: 'refine' });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, draft, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleApplyPrompt('add a phone field');
    });

    expect(result.current.operationError).toBe('Edit service unavailable');
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('does nothing when draft is null', async () => {
    const provider = makeProvider();
    const session = makeSession({ phase: 'refine' });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleApplyPrompt('make name required');
    });

    expect(provider.runEdit).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });
});

/* ── handleOpenStudio ──────────────────────────── */

describe('useInquestOps — handleOpenStudio', () => {
  let assignSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
  });

  it('saves handoff payload and navigates to studio', async () => {
    const provider = makeProvider();
    const draft = new InquestDraft();
    const proposal = buildProposal({
      session: makeSession({ input: { description: 'test', uploads: [], messages: [] } }),
      analysis: buildAnalysis({ session: makeSession({ input: { description: 'test', uploads: [], messages: [] } }) }),
    });
    const session = makeSession({ phase: 'refine', proposal });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, draft, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleOpenStudio();
    });

    expect(assignSpy).toHaveBeenCalledWith(expect.stringMatching(/^\/studio\/?\?h=/));
    expect(updateSession).toHaveBeenCalled();
    assignSpy.mockRestore();
  });

  it('does nothing when draft is null', async () => {
    const provider = makeProvider();
    const session = makeSession({ phase: 'refine', proposal: buildProposal({
      session: makeSession({ input: { description: 'test', uploads: [], messages: [] } }),
      analysis: buildAnalysis({ session: makeSession({ input: { description: 'test', uploads: [], messages: [] } }) }),
    }) });
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, null, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleOpenStudio();
    });

    expect(assignSpy).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
    assignSpy.mockRestore();
  });

  it('does nothing when session has no proposal', async () => {
    const provider = makeProvider();
    const draft = new InquestDraft();
    const session = makeSession({ phase: 'refine' }); // no proposal
    const updateSession = vi.fn();
    const setDraft = vi.fn();

    const { result } = renderHook(() =>
      useInquestOps(session, draft, setDraft, provider, undefined, updateSession),
    );

    await act(async () => {
      await result.current.handleOpenStudio();
    });

    expect(assignSpy).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
    assignSpy.mockRestore();
  });
});
