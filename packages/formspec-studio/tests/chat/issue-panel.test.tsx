import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { IssuePanel } from '../../src/chat/components/IssuePanel.js';
import { ChatProvider } from '../../src/chat/state/ChatContext.js';
import { ChatSession, MockAdapter } from 'formspec-chat';

async function renderIssuePanelWithIssues() {
  const session = new ChatSession({ adapter: new MockAdapter() });
  // Vague message produces issues
  await session.sendMessage('I need a form');

  const result = render(
    <ChatProvider session={session}>
      <IssuePanel />
    </ChatProvider>,
  );
  return { ...result, session };
}

describe('IssuePanel', () => {
  it('shows empty state when no issues', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('housing-intake');

    render(
      <ChatProvider session={session}>
        <IssuePanel />
      </ChatProvider>,
    );

    expect(screen.getByText(/no issues/i)).toBeInTheDocument();
  });

  it('renders open issues', async () => {
    const { session } = await renderIssuePanelWithIssues();

    const issues = session.getIssues();
    const openIssue = issues.find(i => i.status === 'open')!;
    expect(screen.getByText(openIssue.title)).toBeInTheDocument();
  });

  it('shows issue severity', async () => {
    await renderIssuePanelWithIssues();
    // Should show severity labels
    expect(screen.getByText(/info|warning|error/i)).toBeInTheDocument();
  });

  it('resolves an issue when resolve button is clicked', async () => {
    const { session } = await renderIssuePanelWithIssues();
    const openIssue = session.getIssues().find(i => i.status === 'open')!;

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /resolve/i })[0]);
    });

    const updated = session.getIssues().find(i => i.id === openIssue.id)!;
    expect(updated.status).toBe('resolved');
  });

  it('defers an issue when defer button is clicked', async () => {
    const { session } = await renderIssuePanelWithIssues();
    const openIssue = session.getIssues().find(i => i.status === 'open')!;

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /defer/i })[0]);
    });

    const updated = session.getIssues().find(i => i.id === openIssue.id)!;
    expect(updated.status).toBe('deferred');
  });

  it('shows issue count', async () => {
    await renderIssuePanelWithIssues();
    // At least one issue should be displayed
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
  });
});
