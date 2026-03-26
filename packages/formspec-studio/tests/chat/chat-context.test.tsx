import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { ChatProvider, useChatSession, useChatState } from '../../src/chat/state/ChatContext.js';
import { ChatSession, MockAdapter } from 'formspec-chat';
import type { DefinitionDiff } from 'formspec-chat';
import { buildBundleFromDefinition } from 'formspec-studio-core';

function makeSession() {
  return new ChatSession({ adapter: new MockAdapter(), buildBundle: buildBundleFromDefinition });
}

/** Test component that displays chat state. */
function ChatStateDisplay() {
  const session = useChatSession();
  const state = useChatState();
  return (
    <div>
      <span data-testid="session-id">{session.id}</span>
      <span data-testid="message-count">{state.messages.length}</span>
      <span data-testid="has-definition">{String(state.hasDefinition)}</span>
      <span data-testid="open-issues">{state.openIssueCount}</span>
      <span data-testid="definition">{state.definition ? state.definition.title : 'null'}</span>
      <span data-testid="has-diff">{String(state.lastDiff !== null)}</span>
      <span data-testid="has-bundle">{String(state.bundle !== null)}</span>
      <span data-testid="has-component-tree">{String(state.bundle?.component?.tree != null)}</span>
      <span data-testid="ready-to-scaffold">{String(state.readyToScaffold)}</span>
    </div>
  );
}

describe('ChatContext', () => {
  it('provides the chat session via useChatSession', () => {
    const session = makeSession();
    render(
      <ChatProvider session={session}>
        <ChatStateDisplay />
      </ChatProvider>,
    );
    expect(screen.getByTestId('session-id').textContent).toBe(session.id);
  });

  it('provides reactive state via useChatState', () => {
    const session = makeSession();
    render(
      <ChatProvider session={session}>
        <ChatStateDisplay />
      </ChatProvider>,
    );
    expect(screen.getByTestId('message-count').textContent).toBe('0');
    expect(screen.getByTestId('has-definition').textContent).toBe('false');
  });

  it('updates state when session changes', async () => {
    const session = makeSession();
    render(
      <ChatProvider session={session}>
        <ChatStateDisplay />
      </ChatProvider>,
    );

    expect(screen.getByTestId('message-count').textContent).toBe('0');

    await act(async () => {
      await session.startFromTemplate('housing-intake');
    });

    expect(screen.getByTestId('has-definition').textContent).toBe('true');
    expect(Number(screen.getByTestId('message-count').textContent)).toBeGreaterThan(0);
  });

  it('tracks open issue count after scaffold', async () => {
    const session = makeSession();
    render(
      <ChatProvider session={session}>
        <ChatStateDisplay />
      </ChatProvider>,
    );

    await act(async () => {
      await session.sendMessage('I need a form');
      await session.scaffold();
    });

    expect(Number(screen.getByTestId('open-issues').textContent)).toBeGreaterThan(0);
  });

  it('exposes readyToScaffold state', async () => {
    const session = makeSession();
    render(
      <ChatProvider session={session}>
        <ChatStateDisplay />
      </ChatProvider>,
    );

    expect(screen.getByTestId('ready-to-scaffold').textContent).toBe('false');

    // Send 3 messages to trigger readyToScaffold in MockAdapter
    await act(async () => {
      await session.sendMessage('I need a form');
    });
    await act(async () => {
      await session.sendMessage('It collects name and email');
    });
    await act(async () => {
      await session.sendMessage('For new employees');
    });

    expect(screen.getByTestId('ready-to-scaffold').textContent).toBe('true');
  });

  it('exposes the definition when one exists', async () => {
    const session = makeSession();
    render(
      <ChatProvider session={session}>
        <ChatStateDisplay />
      </ChatProvider>,
    );

    expect(screen.getByTestId('definition').textContent).toBe('null');

    await act(async () => {
      await session.startFromTemplate('housing-intake');
    });

    // After template, definition should have a title
    expect(screen.getByTestId('definition').textContent).not.toBe('null');
  });

  // TODO: MockAdapter refinement no longer produces a diff with current API
  it.skip('exposes lastDiff after a refinement', async () => {
    const session = makeSession();
    render(
      <ChatProvider session={session}>
        <ChatStateDisplay />
      </ChatProvider>,
    );

    // No diff initially
    expect(screen.getByTestId('has-diff').textContent).toBe('false');

    // Start from template (no diff — initial scaffold)
    await act(async () => {
      await session.startFromTemplate('housing-intake');
    });
    expect(screen.getByTestId('has-diff').textContent).toBe('false');

    // Refine — should produce a diff
    await act(async () => {
      await session.sendMessage('Add a field for pets');
    });
    expect(screen.getByTestId('has-diff').textContent).toBe('true');
  });

  it('exposes bundle when definition exists', async () => {
    const session = makeSession();
    render(
      <ChatProvider session={session}>
        <ChatStateDisplay />
      </ChatProvider>,
    );

    expect(screen.getByTestId('has-bundle').textContent).toBe('false');

    await act(async () => {
      await session.startFromTemplate('housing-intake');
    });

    expect(screen.getByTestId('has-bundle').textContent).toBe('true');
    expect(screen.getByTestId('has-component-tree').textContent).toBe('true');
  });

  it('throws when useChatSession is used outside provider', () => {
    expect(() => {
      render(<ChatStateDisplay />);
    }).toThrow();
  });
});
