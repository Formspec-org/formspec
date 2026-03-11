// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { FormspecItem } from 'formspec-engine';
import { App } from '../../App';
import { createInitialDefinition, createInitialProjectState, projectSignal } from '../../state/project';

function mountApp() {
  const host = document.createElement('div');
  document.body.append(host);
  render(<App />, host);
  return host;
}

function seedItems(items: FormspecItem[]) {
  projectSignal.value = createInitialProjectState({
    definition: createInitialDefinition({
      title: 'Surface Test Form',
      items
    })
  });
}

function readItemLabel(path: string): string | null {
  const segments = path.split('.').filter(Boolean);
  let currentItems = projectSignal.value.definition.items;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const item = currentItems.find((candidate) => candidate.key === segment);
    if (!item) {
      return null;
    }
    if (index === segments.length - 1) {
      return item.label;
    }
    currentItems = item.children ?? [];
  }

  return null;
}

describe('form surface', () => {
  beforeEach(() => {
    seedItems([
      { type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' },
      {
        type: 'group',
        key: 'address',
        label: 'Address',
        children: [{ type: 'field', key: 'city', label: 'City', dataType: 'string' }]
      },
      { type: 'display', key: 'footer', label: 'Read this before submit' }
    ]);
    document.body.innerHTML = '';
  });

  it('renders item blocks recursively', () => {
    const host = mountApp();

    expect(host.querySelector('[data-testid="surface-item-firstName"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="surface-item-address"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="surface-item-address.city"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="surface-item-footer"]')).not.toBeNull();
  });

  it('updates selection from item clicks and clears on empty-surface click', async () => {
    const host = mountApp();
    const firstField = host.querySelector<HTMLElement>('[data-testid="surface-item-firstName"]');
    const surface = host.querySelector<HTMLElement>('[data-testid="form-surface-document"]');

    expect(firstField).not.toBeNull();
    expect(surface).not.toBeNull();

    await act(async () => {
      firstField?.click();
    });
    expect(projectSignal.value.selection).toBe('firstName');
    expect(host.querySelector('[data-testid="field-inspector"]')).not.toBeNull();

    await act(async () => {
      surface?.click();
    });
    expect(projectSignal.value.selection).toBeNull();
    expect(host.querySelector('[data-testid="form-inspector"]')).not.toBeNull();
  });

  it('edits labels inline and commits back to project state', async () => {
    const host = mountApp();
    const label = host.querySelector<HTMLButtonElement>('[data-testid="label-firstName-display"]');
    expect(label).not.toBeNull();

    await act(async () => {
      label?.click();
    });

    const input = host.querySelector<HTMLInputElement>('[data-testid="label-firstName-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = 'Applicant Name';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    expect(readItemLabel('firstName')).toBe('Applicant Name');
  });

  it('opens slash menu from add-between controls and filters templates', async () => {
    seedItems([
      { type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' },
      { type: 'field', key: 'lastName', label: 'Last Name', dataType: 'string' }
    ]);
    const host = mountApp();
    const betweenButton = host.querySelector<HTMLButtonElement>('[data-testid="add-between-root-1"]');
    expect(betweenButton).not.toBeNull();

    await act(async () => {
      betweenButton?.click();
    });

    const menu = host.querySelector('[data-testid="slash-command-menu"]');
    const search = host.querySelector<HTMLInputElement>('[data-testid="slash-command-search"]');
    expect(menu).not.toBeNull();
    expect(search).not.toBeNull();
    if (!search) {
      return;
    }

    await act(async () => {
      search.value = 'dropdown';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="slash-template-dropdown"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="slash-template-short-answer"]')).toBeNull();
  });

  it('inserts selected slash template with keyboard navigation and focuses inserted label', async () => {
    seedItems([
      { type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' },
      { type: 'field', key: 'lastName', label: 'Last Name', dataType: 'string' }
    ]);
    const host = mountApp();
    const betweenButton = host.querySelector<HTMLButtonElement>('[data-testid="add-between-root-1"]');
    expect(betweenButton).not.toBeNull();

    await act(async () => {
      betweenButton?.click();
    });

    const search = host.querySelector<HTMLInputElement>('[data-testid="slash-command-search"]');
    expect(search).not.toBeNull();
    if (!search) {
      return;
    }

    await act(async () => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(projectSignal.value.definition.items.map((item) => item.key)).toEqual(['firstName', 'longAnswer', 'lastName']);
    expect(projectSignal.value.selection).toBe('longAnswer');

    const labelInput = host.querySelector<HTMLInputElement>('[data-testid="label-longAnswer-input"]');
    expect(labelInput).not.toBeNull();
    expect(document.activeElement).toBe(labelInput);
  });

  it('opens slash menu from slash keyboard trigger on the surface', async () => {
    seedItems([{ type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' }]);
    const host = mountApp();
    const surface = host.querySelector<HTMLElement>('[data-testid="form-surface-document"]');
    expect(surface).not.toBeNull();
    if (!surface) {
      return;
    }

    await act(async () => {
      surface.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    });

    expect(host.querySelector('[data-testid="slash-command-menu"]')).not.toBeNull();
  });

  it('renders drag handles on item blocks', () => {
    const host = mountApp();
    expect(host.querySelector('[data-testid="drag-handle-firstName"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="drag-handle-address"]')).not.toBeNull();
  });

  it('renders linked badge for imported sub-form groups', () => {
    seedItems([
      {
        type: 'group',
        key: 'financials',
        label: 'Financials',
        extensions: {
          'x-linkedSubform': {
            ref: 'https://example.org/forms/budget|2.0.0',
            keyPrefix: 'budget_'
          }
        },
        children: [{ type: 'field', key: 'budget_amount', label: 'Amount', dataType: 'decimal' }]
      }
    ]);
    const host = mountApp();

    const badge = host.querySelector('[data-testid="linked-subform-badge-financials"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('Linked');
  });

  it('renders logic badges and opens matching inspector sections on click', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        title: 'Surface Test Form',
        items: [{ type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' }],
        binds: [
          {
            path: 'firstName',
            required: 'true',
            relevant: '$other = "yes"',
            calculate: 'concat($first, " ", $last)',
            constraint: '$ != ""',
            readonly: '$mode = "locked"'
          }
        ]
      }),
      uiState: {
        inspectorSections: {
          'field:question': false,
          'field:rules': false
        },
        viewMode: 'edit',
        structurePanelOpen: false,
        diagnosticsOpen: false,
        mobilePanel: 'none',
        activePage: null
      }
    });

    const host = mountApp();
    const requiredBadge = host.querySelector<HTMLButtonElement>('[data-testid="logic-badge-firstName-required"]');
    const relevantBadge = host.querySelector<HTMLButtonElement>('[data-testid="logic-badge-firstName-relevant"]');
    const calculateBadge = host.querySelector<HTMLButtonElement>('[data-testid="logic-badge-firstName-calculate"]');
    const constraintBadge = host.querySelector<HTMLButtonElement>('[data-testid="logic-badge-firstName-constraint"]');
    const readonlyBadge = host.querySelector<HTMLButtonElement>('[data-testid="logic-badge-firstName-readonly"]');

    expect(requiredBadge?.textContent).toBe('✱');
    expect(relevantBadge?.textContent).toBe('👁');
    expect(calculateBadge?.textContent).toBe('⚡');
    expect(constraintBadge?.textContent).toBe('✓');
    expect(readonlyBadge?.textContent).toBe('🔒');

    await act(async () => {
      relevantBadge?.click();
    });
    expect(projectSignal.value.selection).toBe('firstName');
    expect(projectSignal.value.uiState.inspectorSections['field:rules']).toBe(true);
    expect(host.querySelector('[data-testid="field-relevant-expression-toggle"]')).not.toBeNull();

    await act(async () => {
      constraintBadge?.click();
    });
    expect(projectSignal.value.uiState.inspectorSections['field:rules']).toBe(true);
    expect(host.querySelector('[data-testid="field-constraint-expression-toggle"]')).not.toBeNull();

    await act(async () => {
      requiredBadge?.click();
    });
    expect(projectSignal.value.uiState.inspectorSections['field:rules']).toBe(true);
    expect(host.querySelector('[data-testid="field-required-toggle"]')).not.toBeNull();
  });
});
