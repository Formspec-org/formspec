// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { FELEditor } from '../controls/FELEditor';
import { createInitialProjectState, projectSignal } from '../../state/project';

function mountEditor(options?: { value?: string; fieldOptions?: Array<{ path: string; label: string }> }) {
  const host = document.createElement('div');
  document.body.append(host);

  let value = options?.value ?? '';
  const rerender = () => {
    render(
      <FELEditor
        label="Expression"
        value={value}
        testId="fel-input"
        fieldOptions={options?.fieldOptions}
        onInput={(next) => {
          value = next;
          rerender();
        }}
      />,
      host
    );
  };

  rerender();

  return {
    host,
    getValue: () => value
  };
}

describe('FELEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    projectSignal.value = createInitialProjectState();
  });

  it('offers $path autocomplete and inserts selected path', async () => {
    const { host, getValue } = mountEditor({
      fieldOptions: [
        { path: 'budgetType', label: 'Budget Type' },
        { path: 'amount', label: 'Amount' }
      ]
    });

    const input = host.querySelector<HTMLTextAreaElement>('[data-testid="fel-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = '$bud';
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const menu = host.querySelector('[data-testid="fel-autocomplete"]');
    const option = host.querySelector('[data-testid="fel-autocomplete-option-0"]');
    expect(menu).not.toBeNull();
    expect(option?.textContent).toContain('budgetType');

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(getValue()).toBe('$budgetType');
  });

  it('renders syntax-highlight preview and function signature tooltip', async () => {
    const { host } = mountEditor({
      value: 'sum($amount)'
    });

    const preview = host.querySelector('[data-testid="fel-highlight"]');
    const functionToken = host.querySelector('[data-testid="fel-token-function-sum"]');

    expect(preview).not.toBeNull();
    expect(functionToken).not.toBeNull();
    expect(functionToken?.getAttribute('title')).toContain('sum');
  });

  it('offers @instance("name").path autocomplete and inserts selected path', async () => {
    const baseDefinition = createInitialProjectState().definition;
    projectSignal.value = createInitialProjectState({
      definition: {
        ...baseDefinition,
        instances: {
          priorYear: {
            data: {
              totalIncome: 200000,
              household: {
                rent: 1500
              }
            }
          }
        }
      }
    });

    const { host, getValue } = mountEditor();
    const input = host.querySelector<HTMLTextAreaElement>('[data-testid="fel-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = "@instance('priorYear').to";
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const menu = host.querySelector('[data-testid="fel-autocomplete"]');
    const option = host.querySelector('[data-testid="fel-autocomplete-option-0"]');
    expect(menu).not.toBeNull();
    expect(option?.textContent).toContain('totalIncome');

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(getValue()).toBe("@instance('priorYear').totalIncome");
  });

  it('offers instance name autocomplete inside instance()', async () => {
    const baseDefinition = createInitialProjectState().definition;
    projectSignal.value = createInitialProjectState({
      definition: {
        ...baseDefinition,
        instances: {
          priorYear: {
            data: {
              totalIncome: 200000
            }
          },
          forecast: {
            data: {
              yearEnd: 2027
            }
          }
        }
      }
    });

    const { host, getValue } = mountEditor();
    const input = host.querySelector<HTMLTextAreaElement>('[data-testid="fel-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = "@instance('p";
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const menu = host.querySelector('[data-testid="fel-autocomplete"]');
    const option = host.querySelector('[data-testid="fel-autocomplete-option-0"]');
    expect(menu).not.toBeNull();
    expect(option?.textContent).toContain('priorYear');

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(getValue()).toBe("@instance('priorYear')");
  });

  it('supports double-quote instance names in autocomplete', async () => {
    const baseDefinition = createInitialProjectState().definition;
    projectSignal.value = createInitialProjectState({
      definition: {
        ...baseDefinition,
        instances: {
          priorYear: {
            data: {
              totalIncome: 200000
            }
          },
          forecast: {
            data: {
              yearEnd: 2027
            }
          }
        }
      }
    });

    const { host } = mountEditor();
    const input = host.querySelector<HTMLTextAreaElement>('[data-testid="fel-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = '@instance("p';
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const option = host.querySelector('[data-testid="fel-autocomplete-option-0"]');
    expect(option?.textContent).toContain('priorYear');

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(input.value).toBe('@instance("priorYear")');
  });

  it('continues to suggest paths after selecting instance name', async () => {
    const baseDefinition = createInitialProjectState().definition;
    projectSignal.value = createInitialProjectState({
      definition: {
        ...baseDefinition,
        instances: {
          priorYear: {
            data: {
              totalIncome: 200000,
              household: {
                rent: 1500
              }
            }
          }
        }
      }
    });

    const { host } = mountEditor();
    const input = host.querySelector<HTMLTextAreaElement>('[data-testid="fel-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = '@instance("p';
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    await act(async () => {
      input.value = '@instance("priorYear").ho';
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const option = host.querySelector('[data-testid="fel-autocomplete-option-0"]');
    expect(option?.textContent).toContain('household');

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(input.value).toBe('@instance("priorYear").household');
  });

  it('does not offer instance name autocomplete when no instances exist', async () => {
    projectSignal.value = createInitialProjectState();

    const { host } = mountEditor();
    const input = host.querySelector<HTMLTextAreaElement>('[data-testid="fel-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = '@instance("';
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const menu = host.querySelector('[data-testid="fel-autocomplete"]');
    expect(menu).toBeNull();
  });

  it('nests autocomplete for deeper instance paths', async () => {
    const baseDefinition = createInitialProjectState().definition;
    projectSignal.value = createInitialProjectState({
      definition: {
        ...baseDefinition,
        instances: {
          priorYear: {
            data: {
              household: {
                rent: {
                  amount: 1500
                }
              }
            }
          }
        }
      }
    });

    const { host, getValue } = mountEditor();
    const input = host.querySelector<HTMLTextAreaElement>('[data-testid="fel-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = "@instance('priorYear').household.r";
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const option = host.querySelector('[data-testid="fel-autocomplete-option-0"]');
    expect(option?.textContent).toContain('household.rent');

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(getValue()).toBe("@instance('priorYear').household.rent");
  });

  it('shows live validation errors for invalid FEL', async () => {
    const { host } = mountEditor();
    const input = host.querySelector<HTMLTextAreaElement>('[data-testid="fel-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = '$amount >';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const error = host.querySelector('[data-testid="fel-validation-error"]');
    expect(error).not.toBeNull();
    expect(error?.textContent?.length).toBeGreaterThan(0);
  });

  it('offers extension function autocomplete from loaded registries', async () => {
    projectSignal.value = createInitialProjectState({
      extensions: {
        registries: [
          {
            id: 'file:acme-registry:2026-03-01T00:00:00Z',
            sourceType: 'file',
            sourceLabel: 'acme-registry.json',
            loadedAt: '2026-03-01T00:00:00Z',
            document: {
              $formspecRegistry: '1.0',
              publisher: {
                name: 'Acme',
                url: 'https://acme.example'
              },
              published: '2026-03-01T00:00:00Z',
              entries: [
                {
                  name: 'x-acme-risk-score',
                  category: 'function',
                  version: '1.0.0',
                  status: 'stable',
                  description: 'Calculates risk score.',
                  compatibility: {
                    formspecVersion: '>=1.0.0 <2.0.0'
                  },
                  parameters: [{ name: 'amount', type: 'number' }],
                  returns: 'number'
                }
              ]
            }
          }
        ]
      }
    });

    const { host, getValue } = mountEditor();
    const input = host.querySelector<HTMLTextAreaElement>('[data-testid="fel-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = 'x_acm';
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const option = host.querySelector('[data-testid="fel-autocomplete-option-0"]');
    expect(option?.textContent).toContain('x_acme_risk_score');

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(getValue()).toBe('x_acme_risk_score()');
  });
});
