import { render, within, fireEvent, cleanup } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { project } from '../state/project';
import { toasts } from '../state/toast';

beforeEach(() => {
  project.value = {
    definition: null,
    component: null,
    theme: null,
    mapping: null,
    registry: null,
    changelog: null,
  };
  toasts.value = [];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EmptyTab', () => {
  it('renders the correct title for the given artifact kind', async () => {
    const { EmptyTab } = await import('../components/empty-tab');
    const { container } = render(<EmptyTab kind="component" />);
    expect(within(container).getByText(/Component not configured/)).toBeTruthy();
  });

  it('renders title and description for theme', async () => {
    const { EmptyTab } = await import('../components/empty-tab');
    const { container } = render(<EmptyTab kind="theme" />);
    expect(within(container).getByText(/Theme not configured/)).toBeTruthy();
    expect(within(container).getByText(/colors, typography/)).toBeTruthy();
  });

  it('clicking Create from Scratch sets the artifact on project', async () => {
    const { EmptyTab } = await import('../components/empty-tab');
    const { ARTIFACT_TEMPLATES } = await import('../components/artifact-editor');

    const { container } = render(<EmptyTab kind="component" />);
    within(container).getByText('Create from Scratch').click();

    expect(project.value.component).toEqual(ARTIFACT_TEMPLATES.component);
  });

  it('clicking Create from Scratch shows a success toast', async () => {
    const { EmptyTab } = await import('../components/empty-tab');

    const { container } = render(<EmptyTab kind="theme" />);
    within(container).getByText('Create from Scratch').click();

    expect(toasts.value.length).toBeGreaterThan(0);
    expect(toasts.value[0].type).toBe('success');
    expect(toasts.value[0].message).toContain('theme');
  });

  it('Create from Scratch uses a clone so mutations do not affect the template', async () => {
    const { EmptyTab } = await import('../components/empty-tab');
    const { ARTIFACT_TEMPLATES } = await import('../components/artifact-editor');

    const { container } = render(<EmptyTab kind="mapping" />);
    within(container).getByText('Create from Scratch').click();

    const projectMapping = project.value.mapping as any;
    projectMapping.rules = [{ id: 'mutated' }];

    // Template should be unaffected
    expect((ARTIFACT_TEMPLATES.mapping as any).rules).toEqual([]);
  });

  it('Import JSON button triggers file input click', async () => {
    const { EmptyTab } = await import('../components/empty-tab');

    const originalCreate = document.createElement.bind(document);
    let capturedInput: HTMLInputElement | null = null;
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...args: any[]) => {
      const el = originalCreate(tag, ...(args as []));
      if (tag === 'input') {
        capturedInput = el as HTMLInputElement;
        vi.spyOn(el as HTMLInputElement, 'click').mockImplementation(() => {});
      }
      return el;
    });

    const { container } = render(<EmptyTab kind="registry" />);
    within(container).getByText('Import JSON').click();

    expect(capturedInput).not.toBeNull();
    expect((capturedInput as any).type).toBe('file');
    expect((capturedInput as any).accept).toBe('.json');
    expect((capturedInput as any).click).toHaveBeenCalled();

    createSpy.mockRestore();
  });
});
