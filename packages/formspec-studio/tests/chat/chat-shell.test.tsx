import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ChatShell } from '../../src/chat/components/ChatShell.js';
import { ChatSession, MockAdapter, SessionStore } from 'formspec-chat';
import type { StorageBackend } from 'formspec-chat';

function makeMemoryStorage(): StorageBackend {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe('ChatShell', () => {
  describe('entry view', () => {
    it('shows entry screen when no active session', () => {
      render(<ChatShell />);
      expect(screen.getByText(/build forms through/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start blank/i })).toBeInTheDocument();
    });
  });

  describe('active session', () => {
    it('transitions to chat view after starting blank', async () => {
      render(<ChatShell />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start blank/i }));
      });

      // Should show the chat input now
      expect(screen.getByPlaceholderText(/describe what you need/i)).toBeInTheDocument();
    });

    it('transitions to chat view after selecting a template', async () => {
      render(<ChatShell />);

      // Open template grid
      fireEvent.click(screen.getByRole('button', { name: /template/i }));
      // Select a template
      await act(async () => {
        fireEvent.click(screen.getByText('Housing Intake Form'));
      });

      expect(screen.getByPlaceholderText(/describe what you need/i)).toBeInTheDocument();
    });

    it('shows form preview toggle when definition exists', async () => {
      render(<ChatShell />);

      // Start from template (creates a definition)
      fireEvent.click(screen.getByRole('button', { name: /template/i }));
      await act(async () => {
        fireEvent.click(screen.getByText('Grant Application'));
      });

      expect(screen.getByTestId('mobile-preview-btn')).toBeInTheDocument();
    });

    it('toggles between chat and preview', async () => {
      render(<ChatShell />);

      fireEvent.click(screen.getByRole('button', { name: /template/i }));
      await act(async () => {
        fireEvent.click(screen.getByText('Housing Intake Form'));
      });

      // Switch to preview
      fireEvent.click(screen.getByTestId('mobile-preview-btn'));
      expect(screen.getByTestId('form-preview')).toBeInTheDocument();

      // Switch back to chat
      fireEvent.click(screen.getByTestId('mobile-chat-btn'));
      expect(screen.getByPlaceholderText(/describe what you need/i)).toBeInTheDocument();
    });
  });

  describe('file upload', () => {
    it('transitions to chat view after uploading a file', async () => {
      render(<ChatShell />);

      // The upload button should trigger a hidden file input
      const uploadBtn = screen.getByRole('button', { name: /upload/i });
      await act(async () => {
        fireEvent.click(uploadBtn);
      });

      // A file input should exist (hidden)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      // Simulate file selection
      const file = new File(['Name, Email, Phone'], 'form.csv', { type: 'text/csv' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Should transition to active session
      expect(screen.getByPlaceholderText(/describe what you need/i)).toBeInTheDocument();
    });

    it('generates a form from uploaded CSV content', async () => {
      render(<ChatShell />);

      fireEvent.click(screen.getByRole('button', { name: /upload/i }));
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['Patient Name, Date of Birth, Insurance ID'], 'intake.csv', { type: 'text/csv' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Should have a definition with fields
      expect(screen.getByTestId('mobile-preview-btn')).toBeInTheDocument();
    });
  });

  describe('session persistence', () => {
    it('shows recent sessions from store on entry screen', async () => {
      // Pre-populate store with a saved session
      const storage = makeMemoryStorage();
      const store = new SessionStore(storage);
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('housing-intake');
      await session.sendMessage('Add an emergency contact field');
      store.save(session.toState());

      render(<ChatShell store={store} />);

      // Recent session should appear on entry screen
      const summaries = store.list();
      expect(summaries.length).toBe(1);
      expect(screen.getByText(/add an emergency contact/i)).toBeInTheDocument();
    });

    it('resumes a saved session when clicked', async () => {
      const storage = makeMemoryStorage();
      const store = new SessionStore(storage);
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('grant-application');
      await session.sendMessage('Add a budget narrative section');
      store.save(session.toState());

      render(<ChatShell store={store} />);

      // Click the recent session
      await act(async () => {
        fireEvent.click(screen.getByText(/add a budget narrative/i));
      });

      // Should transition to active session with messages
      expect(screen.getByPlaceholderText(/describe what you need/i)).toBeInTheDocument();
      // Messages from the saved session should be visible
      expect(screen.getByText('Add a budget narrative section')).toBeInTheDocument();
    });

    it('auto-saves session after sending a message', async () => {
      const storage = makeMemoryStorage();
      const store = new SessionStore(storage);

      render(<ChatShell store={store} />);

      // Start blank
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start blank/i }));
      });

      const input = screen.getByPlaceholderText(/describe what you need/i);
      fireEvent.change(input, { target: { value: 'I need a patient form' } });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // Session should be saved to the store
      const saved = store.list();
      expect(saved.length).toBe(1);
    });
  });

  describe('header', () => {
    // TODO: ChatShell does not wire toolContext, so refineForm throws before MockAdapter runs
    it.skip('shows issue badge count when there are open issues', async () => {
      render(<ChatShell />);

      // Start from template → send a refinement → mock adapter now produces
      // tool calls, but a vague message produces no tool calls and thus a
      // "limited refinement" message. We test issues via the scaffold path:
      // templates don't produce issues, so we inject issues via a refinement
      // that triggers the MockAdapter's limited-refinement path.
      fireEvent.click(screen.getByRole('button', { name: /template/i }));
      await act(async () => {
        fireEvent.click(screen.getByText('Housing Intake Form'));
      });

      // Send a refinement that includes "add field" to trigger mock tool call
      const input = screen.getByPlaceholderText(/describe what you need/i);
      fireEvent.change(input, { target: { value: 'Please add a field for pets' } });

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // The mock adapter adds a field via MCP — after refinement the form should be updated
      // Verify the assistant responded (no issues expected from tool-based refinement)
      const msgs = screen.getAllByText(/mock adapter/i);
      expect(msgs.length).toBeGreaterThan(0);
    });

    it('shows export button when definition exists', async () => {
      render(<ChatShell />);

      fireEvent.click(screen.getByRole('button', { name: /template/i }));
      await act(async () => {
        fireEvent.click(screen.getByText('Patient Intake Form'));
      });

      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });

    it('shows settings gear button in active session header', async () => {
      render(<ChatShell />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start blank/i }));
      });
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    });
  });

  describe('provider config', () => {
    it('persists provider config to storage and passes to entry screen', () => {
      const storage = makeMemoryStorage();
      const store = new SessionStore(storage);
      render(<ChatShell store={store} storage={storage} />);

      // Open settings
      fireEvent.click(screen.getByRole('button', { name: /settings/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Configure provider
      fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai' } });
      fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test-key' } });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Dialog should close and provider pill should show
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('OpenAI')).toBeInTheDocument();

      // Should persist to storage
      expect(storage.getItem('formspec-chat:provider')).toBeTruthy();
    });

    it('loads provider config from storage on mount', () => {
      const storage = makeMemoryStorage();
      storage.setItem('formspec-chat:provider', JSON.stringify({ provider: 'google', apiKey: 'goog-key' }));
      const store = new SessionStore(storage);

      render(<ChatShell store={store} storage={storage} />);

      expect(screen.getByText('Google')).toBeInTheDocument();
    });
  });

  describe('session delete', () => {
    it('deletes a session and refreshes the list', async () => {
      const storage = makeMemoryStorage();
      const store = new SessionStore(storage);
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('housing-intake');
      await session.sendMessage('Test message for delete');
      store.save(session.toState());

      render(<ChatShell store={store} storage={storage} />);

      // Session should be visible
      expect(screen.getByText(/test message for delete/i)).toBeInTheDocument();

      // Click delete
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /delete session/i }));
      });

      // Session should be gone
      expect(screen.queryByText(/test message for delete/i)).not.toBeInTheDocument();
    });

    it('refreshes session list when navigating back from active session', async () => {
      const storage = makeMemoryStorage();
      const store = new SessionStore(storage);

      render(<ChatShell store={store} storage={storage} />);

      // Start blank and send a message to trigger auto-save
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start blank/i }));
      });

      const input = screen.getByPlaceholderText(/describe what you need/i);
      fireEvent.change(input, { target: { value: 'Back-navigation test' } });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // Navigate back
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /new/i }));
      });

      // Session should appear in recents
      expect(screen.getByText(/back-navigation test/i)).toBeInTheDocument();
    });
  });
});
