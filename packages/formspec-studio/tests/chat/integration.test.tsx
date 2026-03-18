import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ChatShell } from '../../src/chat/components/ChatShell.js';
import { SessionStore } from 'formspec-chat';
import type { StorageBackend } from 'formspec-chat';

function makeMemoryStorage(): StorageBackend {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe('Chat UI Integration', () => {
  it('full flow: template → chat → preview → export', async () => {
    render(<ChatShell />);

    // 1. Entry screen
    expect(screen.getByText(/build forms through/i)).toBeInTheDocument();

    // 2. Select a template
    fireEvent.click(screen.getByRole('button', { name: /template/i }));
    await act(async () => {
      fireEvent.click(screen.getByText('Housing Intake Form'));
    });

    // 3. Chat view active with input
    expect(screen.getByPlaceholderText(/describe what you need/i)).toBeInTheDocument();

    // 4. Definition exists — preview + export buttons visible
    expect(screen.getByTestId('mobile-preview-btn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();

    // 5. Switch to preview
    fireEvent.click(screen.getByTestId('mobile-preview-btn'));
    expect(screen.getByTestId('form-preview')).toBeInTheDocument();
    // Preview shows the form title
    expect(screen.getByText('Housing Intake Form')).toBeInTheDocument();
    // Preview shows field labels
    expect(screen.getByText('Applicant Name')).toBeInTheDocument();

    // 6. Switch back to chat, send a refinement
    fireEvent.click(screen.getByTestId('mobile-chat-btn'));
    const input = screen.getByPlaceholderText(/describe what you need/i);
    fireEvent.change(input, { target: { value: 'Add a section for employment history' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // User message appears
    expect(screen.getByText('Add a section for employment history')).toBeInTheDocument();
  });

  it('persistence flow: start → save → reload → resume', async () => {
    const storage = makeMemoryStorage();
    const store = new SessionStore(storage);

    // Session 1: create a form
    const { unmount } = render(<ChatShell store={store} />);

    fireEvent.click(screen.getByRole('button', { name: /template/i }));
    await act(async () => {
      fireEvent.click(screen.getByText('Grant Application'));
    });

    // Send a message to trigger auto-save
    const input = screen.getByPlaceholderText(/describe what you need/i);
    fireEvent.change(input, { target: { value: 'Add impact metrics section' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // Session should be saved
    expect(store.list().length).toBe(1);
    unmount();

    // Session 2: resume from stored session
    render(<ChatShell store={store} />);

    // Entry screen should show the recent session
    expect(screen.getByText(/add impact metrics/i)).toBeInTheDocument();

    // Click to resume
    await act(async () => {
      fireEvent.click(screen.getByText(/add impact metrics/i));
    });

    // Should be in active session with messages
    expect(screen.getByPlaceholderText(/describe what you need/i)).toBeInTheDocument();
    expect(screen.getByText('Add impact metrics section')).toBeInTheDocument();
  });

  it('blank start with vague input enters interview phase', async () => {
    render(<ChatShell />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start blank/i }));
    });

    const input = screen.getByPlaceholderText(/describe what you need/i);
    fireEvent.change(input, { target: { value: 'I need a form' } });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // User message should appear in the chat (interview phase, no definition yet)
    expect(screen.getByText('I need a form')).toBeInTheDocument();
  });
});
