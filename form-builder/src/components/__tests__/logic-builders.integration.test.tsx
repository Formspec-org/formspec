// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { FormspecBind, FormspecItem } from 'formspec-engine';
import { App } from '../../App';
import { createInitialDefinition, createInitialProjectState, projectSignal } from '../../state/project';

function mountApp() {
  const host = document.createElement('div');
  document.body.append(host);
  render(<App />, host);
  return host;
}

function seedState(items: FormspecItem[], selection: string) {
  projectSignal.value = createInitialProjectState({
    definition: createInitialDefinition({
      title: 'Logic Builder Test Form',
      items
    }),
    selection
  });
}

function getBind(path: string): FormspecBind | undefined {
  return projectSignal.value.definition.binds?.find((bind) => bind.path === path);
}

describe('logic builders', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('builds conditions visually and round-trips through FEL mode', async () => {
    seedState(
      [
        { type: 'field', key: 'budgetType', label: 'Budget Type', dataType: 'choice' },
        { type: 'field', key: 'amount', label: 'Amount', dataType: 'number' },
        { type: 'field', key: 'total', label: 'Total', dataType: 'number' }
      ],
      'total'
    );

    const host = mountApp();
    const fieldSelect = host.querySelector<HTMLSelectElement>('[data-testid="field-relevant-row-0-field"]');
    const operatorSelect = host.querySelector<HTMLSelectElement>('[data-testid="field-relevant-row-0-operator"]');
    const valueInput = host.querySelector<HTMLInputElement>('[data-testid="field-relevant-row-0-value"]');

    expect(fieldSelect).not.toBeNull();
    expect(operatorSelect).not.toBeNull();
    expect(valueInput).not.toBeNull();
    if (!fieldSelect || !operatorSelect || !valueInput) {
      return;
    }

    await act(async () => {
      fieldSelect.value = 'budgetType';
      fieldSelect.dispatchEvent(new Event('change', { bubbles: true }));
      operatorSelect.value = 'eq';
      operatorSelect.dispatchEvent(new Event('change', { bubbles: true }));
      valueInput.value = 'detailed';
      valueInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(getBind('total')?.relevant).toBe("$budgetType = 'detailed'");

    const felButton = host.querySelector<HTMLButtonElement>('[data-testid="field-relevant-mode-fel"]');
    expect(felButton).not.toBeNull();

    await act(async () => {
      felButton?.click();
    });

    const felEditor = host.querySelector<HTMLTextAreaElement>('[data-testid="field-relevant-input"]');
    expect(felEditor?.value).toBe("$budgetType = 'detailed'");
    if (!felEditor) {
      return;
    }

    await act(async () => {
      felEditor.value = '$amount > 0';
      felEditor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(getBind('total')?.relevant).toBe('$amount > 0');

    const visualButton = host.querySelector<HTMLButtonElement>('[data-testid="field-relevant-mode-visual"]');
    await act(async () => {
      visualButton?.click();
    });

    const parsedFieldSelect = host.querySelector<HTMLSelectElement>('[data-testid="field-relevant-row-0-field"]');
    const parsedOperatorSelect = host.querySelector<HTMLSelectElement>('[data-testid="field-relevant-row-0-operator"]');
    const parsedValueInput = host.querySelector<HTMLInputElement>('[data-testid="field-relevant-row-0-value"]');

    expect(parsedFieldSelect?.value).toBe('amount');
    expect(parsedOperatorSelect?.value).toBe('gt');
    expect(parsedValueInput?.value).toBe('0');
  });

  it('builds formulas visually and round-trips simple aggregate expressions', async () => {
    seedState(
      [
        {
          type: 'group',
          key: 'expenses',
          label: 'Expenses',
          children: [{ type: 'field', key: 'cost', label: 'Cost', dataType: 'number' }]
        },
        { type: 'field', key: 'total', label: 'Total', dataType: 'number' }
      ],
      'total'
    );

    const host = mountApp();

    const sumButton = host.querySelector<HTMLButtonElement>('[data-testid="field-calculate-template-sum"]');
    const groupSelect = host.querySelector<HTMLSelectElement>('[data-testid="field-calculate-group"]');
    const fieldSelect = host.querySelector<HTMLSelectElement>('[data-testid="field-calculate-field"]');
    expect(sumButton).not.toBeNull();
    expect(groupSelect).not.toBeNull();
    expect(fieldSelect).not.toBeNull();

    await act(async () => {
      sumButton?.click();
      if (groupSelect) {
        groupSelect.value = 'expenses';
        groupSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (fieldSelect) {
        fieldSelect.value = 'expenses.cost';
        fieldSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(getBind('total')?.calculate).toBe('sum($expenses[*].cost)');

    const felButton = host.querySelector<HTMLButtonElement>('[data-testid="field-calculate-mode-fel"]');
    await act(async () => {
      felButton?.click();
    });

    const felEditor = host.querySelector<HTMLTextAreaElement>('[data-testid="field-calculate-input"]');
    expect(felEditor?.value).toBe('sum($expenses[*].cost)');
    if (!felEditor) {
      return;
    }

    await act(async () => {
      felEditor.value = 'count($expenses[*])';
      felEditor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(getBind('total')?.calculate).toBe('count($expenses[*])');

    const visualButton = host.querySelector<HTMLButtonElement>('[data-testid="field-calculate-mode-visual"]');
    await act(async () => {
      visualButton?.click();
    });

    const countButton = host.querySelector<HTMLButtonElement>('[data-testid="field-calculate-template-count"]');
    expect(countButton?.className.includes('is-active')).toBe(true);
  });

  it('builds constraints visually and shows unsupported FEL fallback messaging', async () => {
    seedState([{ type: 'field', key: 'amount', label: 'Amount', dataType: 'number' }], 'amount');
    const host = mountApp();

    const valueInput = host.querySelector<HTMLInputElement>('[data-testid="field-constraint-value"]');
    expect(valueInput).not.toBeNull();
    if (!valueInput) {
      return;
    }

    await act(async () => {
      valueInput.value = '5';
      valueInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(getBind('amount')?.constraint).toBe('$ >= 5');

    const felButton = host.querySelector<HTMLButtonElement>('[data-testid="field-constraint-mode-fel"]');
    await act(async () => {
      felButton?.click();
    });

    const felEditor = host.querySelector<HTMLTextAreaElement>('[data-testid="field-constraint-input"]');
    expect(felEditor?.value).toBe('$ >= 5');
    if (!felEditor) {
      return;
    }

    await act(async () => {
      felEditor.value = '$ + 2';
      felEditor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const visualButton = host.querySelector<HTMLButtonElement>('[data-testid="field-constraint-mode-visual"]');
    await act(async () => {
      visualButton?.click();
    });

    expect(host.querySelector('[data-testid="field-constraint-too-complex"]')).not.toBeNull();

    await act(async () => {
      felEditor.value = 'not(isBlank($))';
      felEditor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      visualButton?.click();
    });

    const operatorSelect = host.querySelector<HTMLSelectElement>('[data-testid="field-constraint-operator"]');
    expect(operatorSelect?.value).toBe('notEmpty');
  });
});
