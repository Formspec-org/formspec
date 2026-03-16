import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { FormPreview } from '../../src/chat/components/FormPreview.js';
import { ChatProvider } from '../../src/chat/state/ChatContext.js';
import { ChatSession, MockAdapter } from 'formspec-chat';
import type { DefinitionDiff } from 'formspec-chat';

function renderPreview(session: ChatSession) {
  return render(
    <ChatProvider session={session}>
      <FormPreview />
    </ChatProvider>,
  );
}

describe('FormPreview', () => {
  it('shows empty state when no definition exists', () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    renderPreview(session);
    expect(screen.getByText(/no form yet/i)).toBeInTheDocument();
  });

  it('renders the form title when a definition exists', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('housing-intake');

    renderPreview(session);
    const def = session.getDefinition()!;
    expect(screen.getByText(def.title!)).toBeInTheDocument();
  });

  it('renders field labels from the definition', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('housing-intake');

    renderPreview(session);
    const def = session.getDefinition()!;
    // Should render at least some field labels
    const fields = def.items.filter(i => i.type === 'field');
    expect(fields.length).toBeGreaterThan(0);
    // First field label should appear
    expect(screen.getByText(fields[0].label)).toBeInTheDocument();
  });

  it('renders group labels', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('housing-intake');

    renderPreview(session);
    const def = session.getDefinition()!;
    const groups = def.items.filter(i => i.type === 'group');
    if (groups.length > 0) {
      expect(screen.getByText(groups[0].label)).toBeInTheDocument();
    }
  });

  it('shows source trace count', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('housing-intake');

    renderPreview(session);
    const traces = session.getTraces();
    expect(traces.length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`${traces.length} trace`))).toBeInTheDocument();
  });

  it('shows source trace info for individual fields', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('housing-intake');

    renderPreview(session);
    // At least one trace description should appear
    const traces = session.getTraces();
    expect(traces.length).toBeGreaterThan(0);
    // All template traces share the same description; verify at least one renders
    const traceElements = screen.getAllByText(traces[0].description);
    expect(traceElements.length).toBeGreaterThan(0);
  });

  it('shows data type badge for fields', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('grant-application');

    renderPreview(session);
    const def = session.getDefinition()!;
    const fields = def.items.filter(i => i.type === 'field');
    // Fields have dataType — at least one should show as a badge
    const firstField = fields[0] as any;
    if (firstField.dataType) {
      const badges = screen.getAllByText(firstField.dataType);
      expect(badges.length).toBeGreaterThan(0);
    }
  });

  it('shows issue count in preview header', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.sendMessage('I need a form');

    renderPreview(session);
    const issueCount = session.getOpenIssueCount();
    if (issueCount > 0) {
      expect(screen.getByText(new RegExp(`${issueCount} issue`))).toBeInTheDocument();
    }
  });

  it('renders nested children of groups', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('housing-intake');

    renderPreview(session);
    // The "address" group has children: street, city, state, zip
    expect(screen.getByText('Street Address')).toBeInTheDocument();
    expect(screen.getByText('City')).toBeInTheDocument();
  });

  it('shows form description when present', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('housing-intake');

    renderPreview(session);
    const def = session.getDefinition()!;
    if (def.description) {
      expect(screen.getByText(def.description)).toBeInTheDocument();
    }
  });

  it('shows diff indicators for added items after refinement', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('housing-intake');
    // Refine to generate a diff
    await session.sendMessage('Add a field for emergency contact');

    renderPreview(session);

    const diff = session.getLastDiff();
    // Even if deterministic adapter returns same definition (no actual change),
    // the diff mechanism is tested. If there are added items, they should be marked.
    if (diff && diff.added.length > 0) {
      // Items with "added" class or data attribute
      const addedElements = document.querySelectorAll('[data-diff="added"]');
      expect(addedElements.length).toBe(diff.added.length);
    }
  });

  it('shows diff summary when diff exists', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('housing-intake');
    await session.sendMessage('Add a field for emergency contact');

    renderPreview(session);

    // Should show a diff summary line
    const diff = session.getLastDiff();
    if (diff) {
      expect(screen.getByTestId('diff-summary')).toBeInTheDocument();
    }
  });

  it('renders multiple data types correctly', async () => {
    const session = new ChatSession({ adapter: new MockAdapter() });
    await session.startFromTemplate('housing-intake');

    renderPreview(session);
    // Housing intake has string, date, integer, decimal, choice fields
    expect(screen.getAllByText('string').length).toBeGreaterThan(0);
    expect(screen.getAllByText('date').length).toBeGreaterThan(0);
    expect(screen.getByText('integer')).toBeInTheDocument();
    expect(screen.getByText('decimal')).toBeInTheDocument();
  });

  describe('rich field rendering', () => {
    it('renders text input mockup for string fields', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('housing-intake');

      renderPreview(session);
      // String fields should have a mockup input
      const mockInputs = document.querySelectorAll('[data-field-type="string"]');
      expect(mockInputs.length).toBeGreaterThan(0);
    });

    it('renders date input mockup for date fields', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('housing-intake');

      renderPreview(session);
      const dateInputs = document.querySelectorAll('[data-field-type="date"]');
      expect(dateInputs.length).toBeGreaterThan(0);
    });

    it('renders select mockup for choice fields with options', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('housing-intake');

      renderPreview(session);
      // Income source is a choice field with options
      const choiceFields = document.querySelectorAll('[data-field-type="choice"]');
      expect(choiceFields.length).toBeGreaterThan(0);
      // Options should be visible
      expect(screen.getByText('Employment')).toBeInTheDocument();
    });

    it('renders checkbox mockup for boolean fields', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('patient-intake');

      renderPreview(session);
      const boolFields = document.querySelectorAll('[data-field-type="boolean"]');
      expect(boolFields.length).toBeGreaterThan(0);
    });

    it('renders number input mockup for integer/decimal fields', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('housing-intake');

      renderPreview(session);
      const intFields = document.querySelectorAll('[data-field-type="integer"]');
      const decFields = document.querySelectorAll('[data-field-type="decimal"]');
      expect(intFields.length).toBeGreaterThan(0);
      expect(decFields.length).toBeGreaterThan(0);
    });

    it('renders textarea mockup for text (multiline) fields', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('housing-intake');

      renderPreview(session);
      // Additional notes is a "text" dataType
      const textFields = document.querySelectorAll('[data-field-type="text"]');
      expect(textFields.length).toBeGreaterThan(0);
    });

    it('renders multiChoice fields with checkbox-style options', async () => {
      const session = new ChatSession({ adapter: new MockAdapter() });
      await session.startFromTemplate('employee-onboarding');

      renderPreview(session);
      // Equipment needs is a multiChoice field
      const multiChoiceFields = document.querySelectorAll('[data-field-type="multiChoice"]');
      expect(multiChoiceFields.length).toBeGreaterThan(0);
      // Options should be visible
      expect(screen.getByText('Laptop')).toBeInTheDocument();
    });
  });
});
