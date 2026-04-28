/** @filedesc Tests for ChatPanel scaffold-as-changeset flow. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ChatSession } from '@formspec-org/chat';
import { createLocalChatThreadRepository, clearAllLocalChatThreadScopes } from '../../src/components/chat/chat-thread-repository.js';
import { createLocalVersionRepository } from '../../src/components/chat/version-repository.js';
import { clearAllLocalVersionScopes } from '../../src/components/chat/version-repository.js';

// Replace GeminiAdapter with MockAdapter so tests don't hit real APIs
vi.mock('@formspec-org/chat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@formspec-org/chat')>();
  return {
    ...actual,
    GeminiAdapter: actual.MockAdapter,
  };
});

import { ChatPanel } from '../../src/components/ChatPanel.js';

const STORAGE_KEY = 'formspec:provider-config';

// ── Helpers ──────────────────────────────────────────────────────────

beforeEach(() => {
  // Seed a fake API key so ChatPanel shows the chat input instead of the API key prompt
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: 'google', apiKey: 'test-key-for-unit-tests' }));
  clearAllLocalChatThreadScopes(localStorage);
  clearAllLocalVersionScopes(localStorage);
});

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
  clearAllLocalChatThreadScopes(localStorage);
  clearAllLocalVersionScopes(localStorage);
});

function renderChatPanel(project?: Project) {
  const p = project ?? createProject();
  const onClose = vi.fn();
  const repository = createLocalChatThreadRepository(localStorage);
  const versionRepository = createLocalVersionRepository(localStorage);
  return {
    ...render(<ChatPanel project={p} onClose={onClose} chatThreadRepository={repository} chatProjectScope="test-scope" versionRepository={versionRepository} />),
    project: p,
    onClose,
    repository,
    versionRepository,
  };
}

async function seedDraftViaUpload() {
  const fileInput = screen.getByLabelText(/upload source file/i);
  const file = new File(['Fields: Full name, Date of birth'], 'source.txt', { type: 'text/plain' });
  await act(async () => {
    fireEvent.change(fileInput, { target: { files: [file] } });
  });
  await waitFor(() => {
    expect(screen.getByTestId('changeset-review')).toBeInTheDocument();
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ChatPanel scaffold-as-changeset', () => {
  it('shows Generate Form button when session is ready to scaffold', async () => {
    const { project } = renderChatPanel();
    const input = screen.getByRole('textbox');

    // MockAdapter returns readyToScaffold=true after 3 user messages
    for (const msg of ['I need a patient intake form', 'For a clinic', 'Name, date of birth, allergies']) {
      fireEvent.change(input, { target: { value: msg } });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });
    }

    // The "Generate Form" button should appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate form/i })).toBeInTheDocument();
    });
  });

  it('does not show Generate Form button before session is ready', async () => {
    renderChatPanel();
    const input = screen.getByRole('textbox');

    // Send only 1 message — not enough for readyToScaffold
    fireEvent.change(input, { target: { value: 'I need a form' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(screen.queryByRole('button', { name: /generate form/i })).not.toBeInTheDocument();
  });

  it('clicking Generate Form opens a changeset, loads the scaffold, and closes for review', async () => {
    const project = createProject();
    renderChatPanel(project);
    const input = screen.getByRole('textbox');

    // Drive session to readyToScaffold
    for (const msg of ['I need a patient intake form', 'For a clinic', 'Name, date of birth, allergies']) {
      fireEvent.change(input, { target: { value: msg } });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });
    }

    // Click Generate Form
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate form/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /generate form/i }));
    });

    // After scaffold, changeset should be pending for review
    await waitFor(() => {
      const pm = project.proposals;
      expect(pm).not.toBeNull();
      expect(pm!.changeset).not.toBeNull();
      expect(pm!.changeset!.status).toBe('pending');
    });

    // The ChangesetReview component should render
    await waitFor(() => {
      expect(screen.getByTestId('changeset-review')).toBeInTheDocument();
    });

    // Conversation stays visible in a ribbon above review (chat-first UX)
    expect(screen.getByTestId('chat-message-list-ribbon')).toBeInTheDocument();
    expect(screen.getByText(/Review impacted scope/i)).toBeInTheDocument();
  });

  it('scaffold changeset label describes the generated form', async () => {
    const project = createProject();
    renderChatPanel(project);
    const input = screen.getByRole('textbox');

    for (const msg of ['I need a patient intake form', 'For a clinic', 'Name, date of birth, allergies']) {
      fireEvent.change(input, { target: { value: msg } });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate form/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /generate form/i }));
    });

    await waitFor(() => {
      const changeset = project.proposals?.changeset;
      expect(changeset).not.toBeNull();
      expect(changeset!.label).toMatch(/scaffold/i);
    });
  });

  it('uses project.proposals instead of private _proposalManager', () => {
    const project = createProject();
    // Verify the public API exists
    expect(project.proposals).not.toBeNull();
    expect(project.proposals).toHaveProperty('openChangeset');
    expect(project.proposals).toHaveProperty('closeChangeset');
  });

  it('hides Generate Form button after scaffold is submitted', async () => {
    const project = createProject();
    renderChatPanel(project);
    const input = screen.getByRole('textbox');

    // Drive session to readyToScaffold
    for (const msg of ['I need a patient intake form', 'For a clinic', 'Name, date of birth, allergies']) {
      fireEvent.change(input, { target: { value: msg } });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate form/i })).toBeInTheDocument();
    });

    // Click Generate Form
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /generate form/i }));
    });

    // Button should disappear after scaffold
    expect(screen.queryByRole('button', { name: /generate form/i })).not.toBeInTheDocument();
  });

  it('loads the scaffolded definition into the project', async () => {
    const project = createProject();
    const originalTitle = project.definition.title;
    renderChatPanel(project);
    const input = screen.getByRole('textbox');

    for (const msg of ['I need a patient intake form', 'For a clinic', 'Name, date of birth, allergies']) {
      fireEvent.change(input, { target: { value: msg } });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate form/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /generate form/i }));
    });

    // After accepting the changeset, the project should have the scaffolded definition
    await waitFor(() => {
      const changeset = project.proposals?.changeset;
      expect(changeset?.status).toBe('pending');
    });

    // The definition should have changed (scaffold loaded)
    // Accept the changeset to confirm the definition is applied
    const result = project.proposals!.acceptChangeset();
    expect(result.ok).toBe(true);

    // After accept, definition should have the scaffold's content
    expect(project.definition.items.length).toBeGreaterThan(0);
  });

  it('uploads a text source and opens a scaffold changeset', async () => {
    const project = createProject();
    renderChatPanel(project);

    const fileInput = screen.getByLabelText(/upload source file/i);
    const file = new File(['Fields: Full name, Date of birth, Household income'], 'source.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      const changeset = project.proposals?.changeset;
      expect(changeset).not.toBeNull();
      expect(changeset!.status).toBe('pending');
      expect(changeset!.label).toMatch(/upload scaffold/i);
    });

    const studioExt = (project.definition.extensions as Record<string, any> | undefined)?.['x-studio'];
    expect(studioExt).toBeDefined();
    expect(studioExt.patches.some((patch: any) => patch.status === 'open' && String(patch.id).startsWith('changeset:'))).toBe(true);

    await waitFor(() => {
      expect(screen.getByTestId('changeset-review')).toBeInTheDocument();
    });
  });

  it('accepting an uploaded source changeset keeps extracted fields in the project', async () => {
    const project = createProject();
    renderChatPanel(project);

    const fileInput = screen.getByLabelText(/upload source file/i);
    const file = new File(['Fields: Full name, Date of birth, Household income'], 'source.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(project.proposals?.changeset?.status).toBe('pending');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
    });
    expect(project.definition.items.map((item) => item.label)).toEqual([
      'Full name',
      'Date of birth',
      'Household income',
    ]);

    const studioExt = (project.definition.extensions as Record<string, any> | undefined)?.['x-studio'];
    expect(studioExt).toBeDefined();
    expect(Array.isArray(studioExt.patches)).toBe(true);
    expect(studioExt.patches.some((patch: any) => patch.status === 'accepted' && String(patch.id).startsWith('changeset:'))).toBe(true);
    expect(Array.isArray(studioExt.provenance)).toBe(true);
    expect(studioExt.provenance.some((entry: any) => entry.origin === 'ai')).toBe(true);
  });

  it('does not show Generate Form button while changeset review is shown', async () => {
    const project = createProject();
    renderChatPanel(project);
    const input = screen.getByRole('textbox');

    for (const msg of ['I need a patient intake form', 'For a clinic', 'Name, date of birth, allergies']) {
      fireEvent.change(input, { target: { value: msg } });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate form/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /generate form/i }));
    });

    // Now we're in review mode — the generate button should not appear
    await waitFor(() => {
      expect(screen.getByTestId('changeset-review')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /generate form/i })).not.toBeInTheDocument();
  });

  it('records rejected durable patch status when review is rejected', async () => {
    const project = createProject();
    renderChatPanel(project);

    const fileInput = screen.getByLabelText(/upload source file/i);
    const file = new File(['Fields: Full name, Date of birth, Household income'], 'source.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(project.proposals?.changeset?.status).toBe('pending');
      expect(screen.getByTestId('changeset-review')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reject all/i }));
    });

    const studioExt = (project.definition.extensions as Record<string, any> | undefined)?.['x-studio'];
    expect(studioExt).toBeDefined();
    expect(studioExt.patches.some((patch: any) => patch.status === 'rejected' && String(patch.id).startsWith('changeset:'))).toBe(true);
    const confirmedAiProvenance = (studioExt.provenance ?? []).filter((entry: any) => entry.origin === 'ai' && entry.reviewStatus === 'confirmed');
    expect(confirmedAiProvenance.length).toBe(0);
  });

  it('routes slash commands through ChatSession refinement path', async () => {
    const project = createProject();
    renderChatPanel(project);
    await seedDraftViaUpload();

    const sendSpy = vi.spyOn(ChatSession.prototype, 'sendMessage');
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '/layout hide items.name' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('Apply layout update via MCP tools. User intent: hide items.name'));
    });
    sendSpy.mockRestore();
  });

  it('accepts freeform slash intent without JSON payloads', async () => {
    const project = createProject();
    renderChatPanel(project);
    await seedDraftViaUpload();
    const sendSpy = vi.spyOn(ChatSession.prototype, 'sendMessage');
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '/mapping set description to AI configured' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('User intent: set description to AI configured'));
    });
    sendSpy.mockRestore();
  });

  it('supports /init and allows slash commands before scaffold/upload', async () => {
    const project = createProject();
    renderChatPanel(project);
    const sendSpy = vi.spyOn(ChatSession.prototype, 'sendMessage');
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '/init' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByText(/assistant context initialized from the current draft/i)).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: '/layout hide items.name' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('Apply layout update via MCP tools. User intent: hide items.name'));
    });
    sendSpy.mockRestore();
  });

  it('creates a new thread while retaining prior attempts', async () => {
    renderChatPanel();
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'thread one message' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('chat-thread-list')).toBeInTheDocument();
      expect(screen.queryAllByTestId(/chat-thread-chat-/).length).toBeGreaterThan(0);
    });
    const before = screen.queryAllByTestId(/chat-thread-chat-/).length;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start new chat/i }));
    });
    fireEvent.change(input, { target: { value: 'thread two message' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.queryAllByTestId(/chat-thread-chat-/).length).toBeGreaterThan(before);
    });
  });

  it('filters thread history by scope', async () => {
    const repository = createLocalChatThreadRepository(localStorage);
    const first = render(
      <ChatPanel
        project={createProject()}
        onClose={vi.fn()}
        chatThreadRepository={repository}
        chatProjectScope="scope-one"
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'scope one conversation' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await waitFor(() => {
      expect(screen.queryAllByTestId(/chat-thread-chat-/).length).toBeGreaterThan(0);
    });
    first.unmount();

    render(
      <ChatPanel
        project={createProject()}
        onClose={vi.fn()}
        chatThreadRepository={repository}
        chatProjectScope="scope-two"
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('chat-thread-list')).toBeInTheDocument();
    });
    expect(screen.queryAllByTestId(/chat-thread-chat-/)).toHaveLength(0);
  });

  it('clear all only removes threads in current scope', async () => {
    const repository = createLocalChatThreadRepository(localStorage);
    const scopeOne = render(
      <ChatPanel
        project={createProject()}
        onClose={vi.fn()}
        chatThreadRepository={repository}
        chatProjectScope="scope-clear-one"
      />
    );
    let input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'scope clear one' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await waitFor(() => {
      expect(screen.queryAllByTestId(/chat-thread-chat-/).length).toBeGreaterThan(0);
    });
    scopeOne.unmount();

    const scopeTwo = render(
      <ChatPanel
        project={createProject()}
        onClose={vi.fn()}
        chatThreadRepository={repository}
        chatProjectScope="scope-clear-two"
      />
    );
    input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'scope clear two' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await waitFor(() => {
      expect(screen.queryAllByTestId(/chat-thread-chat-/).length).toBeGreaterThan(0);
    });
    scopeTwo.unmount();

    render(
      <ChatPanel
        project={createProject()}
        onClose={vi.fn()}
        chatThreadRepository={repository}
        chatProjectScope="scope-clear-one"
      />
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    });
    await waitFor(() => {
      expect(screen.queryAllByTestId(/chat-thread-chat-/)).toHaveLength(0);
    });

    const scopeTwoThreads = await repository.listThreads({ projectScope: 'scope-clear-two' });
    expect(scopeTwoThreads.items.length).toBeGreaterThan(0);
  });
});
