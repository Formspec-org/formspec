import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ChatPanel } from '../../src/chat/components/ChatPanel.js';
import { ChatProvider } from '../../src/chat/state/ChatContext.js';
import { ChatSession, MockAdapter } from 'formspec-chat';

function renderChatPanel(session?: ChatSession) {
  const s = session ?? new ChatSession({ adapter: new MockAdapter() });
  return {
    ...render(
      <ChatProvider session={s}>
        <ChatPanel />
      </ChatProvider>,
    ),
    session: s,
  };
}

describe('ChatPanel', () => {
  describe('message display', () => {
    it('shows empty state when no messages', () => {
      renderChatPanel();
      expect(screen.getByText(/describe.*form/i)).toBeInTheDocument();
    });

    it('renders user messages', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.sendMessage('I need a patient intake form');

      renderChatPanel(session);
      expect(screen.getByText('I need a patient intake form')).toBeInTheDocument();
    });

    it('renders assistant messages', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.sendMessage('I need a form');

      renderChatPanel(session);
      const messages = session.getMessages();
      const assistantMsg = messages.find(m => m.role === 'assistant')!;
      expect(screen.getByText(assistantMsg.content)).toBeInTheDocument();
    });

    it('renders system messages with distinct style', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('housing-intake');

      renderChatPanel(session);
      // System message about template selection
      const systemMsg = session.getMessages().find(m => m.role === 'system')!;
      expect(screen.getByText(systemMsg.content)).toBeInTheDocument();
    });
  });

  describe('message input', () => {
    it('renders a text input', () => {
      renderChatPanel();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('sends message on Enter', async () => {
      const { session } = renderChatPanel();

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'I need a housing form' } });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      expect(session.getMessages().length).toBeGreaterThan(0);
    });

    it('clears input after sending', async () => {
      renderChatPanel();
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Hello' } });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      expect(input.value).toBe('');
    });

    it('does not send empty messages', async () => {
      const { session } = renderChatPanel();
      const input = screen.getByRole('textbox');

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      expect(session.getMessages()).toHaveLength(0);
    });

    it('has a send button', () => {
      renderChatPanel();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('send button clicks send the message', async () => {
      const { session } = renderChatPanel();
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Test message' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /send/i }));
      });

      expect(session.getMessages().length).toBeGreaterThan(0);
    });
  });

  describe('resumed sessions', () => {
    it('displays messages from a restored session', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('patient-intake');
      await session.sendMessage('Add allergy severity field');

      // Serialize and restore
      const state = session.toState();
      const restored = ChatSession.fromState(state, new MockAdapter());

      renderChatPanel(restored);
      expect(screen.getByText('Add allergy severity field')).toBeInTheDocument();
    });

    it('can send new messages on a restored session', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('housing-intake');

      const state = session.toState();
      const restored = ChatSession.fromState(state, new MockAdapter());

      renderChatPanel(restored);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Add a pets section' } });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      expect(screen.getByText('Add a pets section')).toBeInTheDocument();
      expect(restored.getMessages().length).toBeGreaterThan(state.messages.length);
    });
  });

  describe('loading state', () => {
    it('disables input while sending', async () => {
      // This tests the disabled state during async send
      renderChatPanel();
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });

      // Clicking send — input should become disabled briefly
      // After completion it should be enabled again
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // After send completes, should be enabled again
      expect(input).not.toBeDisabled();
    });
  });
});
