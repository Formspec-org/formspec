/** @filedesc Tests for the first-run onboarding workspace and source/start controls. */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { AssistantWorkspace } from '../../src/onboarding/AssistantWorkspace';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { ActiveGroupProvider } from '../../src/state/useActiveGroup';

vi.mock('@formspec-org/chat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@formspec-org/chat')>();
  return {
    ...actual,
    GeminiAdapter: actual.MockAdapter,
  };
});

const STORAGE_KEY = 'formspec:provider-config';

function renderOnboarding(project: Project = createProject()) {
  const onEnterStudio = vi.fn();
  render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ActiveGroupProvider>
          <AssistantWorkspace project={project} onEnterStudio={onEnterStudio} />
        </ActiveGroupProvider>
      </SelectionProvider>
    </ProjectProvider>,
  );
  return { project, onEnterStudio };
}

describe('AssistantWorkspace', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads the selected starter into the same project', async () => {
    const { project } = renderOnboarding();

    expect(screen.getByText('Choose a starting path')).toBeInTheDocument();
    expect(screen.getByText('Workspace status')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: /Use selected starter/i }).click();
    });

    expect(project.definition.title).toBe('Section 8 HCV — Intake');
    expect(project.statistics().fieldCount).toBeGreaterThan(20);
    expect(screen.getByRole('heading', { name: 'Section 8 HCV — Intake' })).toBeInTheDocument();
    expect(screen.getByText('Applicant Information')).toBeInTheDocument();
  });

  it('loads a dropped JSON definition without requiring an assistant provider', async () => {
    const { project } = renderOnboarding();
    const source = {
      $formspec: '1.0',
      name: 'dropped-source',
      title: 'Dropped Source Form',
      status: 'draft',
      items: [
        { key: 'fullName', type: 'field', label: 'Full Name', dataType: 'string' },
        { key: 'income', type: 'field', label: 'Income', dataType: 'decimal' },
      ],
    };
    const file = new File([JSON.stringify(source)], 'definition.json', { type: 'application/json' });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/upload source document/i), { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(project.definition.title).toBe('Dropped Source Form');
    });
    expect(project.definition.items.map((item) => item.label)).toEqual(['Full Name', 'Income']);
    expect(screen.getByText('definition.json loaded as current draft')).toBeInTheDocument();
    expect(screen.getAllByText(/Loaded definition.json/).length).toBeGreaterThan(0);
  });

  it('opens provider settings for non-JSON source files when no assistant is configured', async () => {
    renderOnboarding();
    const file = new File(['Fields: Name'], 'source.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/upload source document/i), { target: { files: [file] } });
    });

    expect(screen.getByRole('dialog', { name: /App Settings/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Configure the assistant provider before analyzing source files/).length).toBeGreaterThan(0);
  });

  it('uploads a text source through the assistant and shows pending review state', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: 'google', apiKey: 'test-key' }));
    const { project } = renderOnboarding();
    const file = new File(['Fields: Full name, Date of birth, Household income'], 'source.txt', { type: 'text/plain' });

    await waitFor(() => {
      expect(screen.getByText(/Analyze a source into a reviewable draft/)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/upload source document/i), { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(project.proposals?.changeset?.status).toBe('pending');
    });
    expect(screen.getByText('source.txt generated a draft')).toBeInTheDocument();
    expect(screen.getAllByText(/pending/).length).toBeGreaterThan(0);

    const result = project.proposals!.acceptChangeset();
    expect(result.ok).toBe(true);
    expect(project.definition.items.map((item) => item.label)).toEqual([
      'Full name',
      'Date of birth',
      'Household income',
    ]);
  });

  it('requires confirmation before replacing after assistant mutation', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: 'google', apiKey: 'test-key' }));
    const { project } = renderOnboarding();

    await act(async () => {
      fireEvent.change(screen.getByTestId('assistant-composer-input'), { target: { value: 'Build an intake form' } });
      fireEvent.click(screen.getByRole('button', { name: /Send message/i }));
    });

    await act(async () => {
      screen.getByRole('button', { name: /Use selected starter/i }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });
    expect(screen.getByText(/Use Section 8 HCV intake will replace the current project/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: /^Cancel$/i }));
    });

    expect(screen.queryByRole('heading', { name: 'Section 8 HCV — Intake' })).not.toBeInTheDocument();
    expect(screen.queryByText('Applicant Information')).not.toBeInTheDocument();
  });

  it('requires confirmation before blank reset after manual project mutation', async () => {
    const { project } = renderOnboarding();
    project.loadBundle({
      definition: {
        $formspec: '1.0',
        name: 'manual-edit',
        title: 'Manual Edit',
        status: 'draft',
        items: [{ key: 'a', type: 'field', label: 'A', dataType: 'string' }],
      },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Blank form/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: /^Cancel$/i }));
    });

    expect(project.definition.title).toBe('Manual Edit');
  });

  it('requires confirmation before loading JSON source when project is already mutated', async () => {
    const { project } = renderOnboarding();
    project.loadBundle({
      definition: {
        $formspec: '1.0',
        name: 'existing',
        title: 'Existing Form',
        status: 'draft',
        items: [{ key: 'name', type: 'field', label: 'Name', dataType: 'string' }],
      },
    });
    const file = new File([JSON.stringify({
      $formspec: '1.0',
      name: 'incoming',
      title: 'Incoming Form',
      status: 'draft',
      items: [{ key: 'income', type: 'field', label: 'Income', dataType: 'decimal' }],
    })], 'definition.json', { type: 'application/json' });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/upload source document/i), { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: /^Cancel$/i }));
    });

    expect(project.definition.title).toBe('Existing Form');
  });

  it('requires confirmation before using a starter after accepting an assistant changeset', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: 'google', apiKey: 'test-key' }));
    const { project } = renderOnboarding();
    const file = new File(['Fields: Full name, Date of birth'], 'source.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/upload source document/i), { target: { files: [file] } });
    });
    await waitFor(() => expect(project.proposals?.changeset?.status).toBe('pending'));
    project.proposals?.acceptChangeset();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Use selected starter/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: /^Cancel$/i }));
    });

    expect(project.definition.items.map((item) => item.label)).toEqual(['Full name', 'Date of birth']);
  });

  it('keeps provider settings closed for non-JSON uploads when provider is configured', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: 'google', apiKey: 'test-key' }));
    renderOnboarding();
    const file = new File(['Fields: Name'], 'source.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/upload source document/i), { target: { files: [file] } });
    });

    expect(screen.queryByRole('dialog', { name: /App Settings/i })).not.toBeInTheDocument();
  });

  it('supports onboarding focus actions for keyboard and assistive navigation', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: 'google', apiKey: 'test-key' }));
    renderOnboarding();

    const describeButton = screen.getByRole('button', { name: 'Describe it' });
    const starterButton = screen.getByRole('button', { name: 'Browse starters' });
    const composer = screen.getByLabelText('Assistant composer');
    const starterRail = screen.getByLabelText('Start controls and starter catalog');

    fireEvent.click(describeButton);
    expect(composer).toHaveFocus();

    fireEvent.click(starterButton);
    expect(starterRail).toHaveFocus();
  });

  it('emits onboarding telemetry events with variant and build mode metadata', async () => {
    const telemetryEvents: Array<Record<string, unknown>> = [];
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      telemetryEvents.push(detail);
    };
    window.addEventListener('formspec:onboarding-telemetry', listener);
    try {
      renderOnboarding();

      await waitFor(() => {
        expect(telemetryEvents.some((event) => event.name === 'onboarding_viewed')).toBe(true);
      });

      await act(async () => {
        screen.getByRole('button', { name: /Use selected starter/i }).click();
      });

      const viewed = telemetryEvents.find((event) => event.name === 'onboarding_viewed');
      const starter = telemetryEvents.find((event) => event.name === 'onboarding_starter_selected');
      const firstEdit = telemetryEvents.find((event) => event.name === 'onboarding_first_meaningful_edit');

      expect(viewed?.variant).toBe('assistant-first');
      expect(typeof viewed?.buildMode).toBe('string');
      expect(starter?.starterId).toBe('section-8-hcv-intake');
      expect(firstEdit?.trigger).toBe('field_count_increase');
    } finally {
      window.removeEventListener('formspec:onboarding-telemetry', listener);
    }
  });
});
