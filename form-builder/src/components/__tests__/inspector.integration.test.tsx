// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { FormspecItem } from 'formspec-engine';
import { App } from '../../App';
import {
  createInitialComponent,
  createInitialDefinition,
  createInitialMapping,
  createInitialProjectState,
  createInitialTheme,
  projectSignal
} from '../../state/project';

function mountApp() {
  const host = document.createElement('div');
  document.body.append(host);
  render(<App />, host);
  return host;
}

function seedState(items: FormspecItem[], selection: string | null = null) {
  projectSignal.value = createInitialProjectState({
    definition: createInitialDefinition({
      title: 'Inspector Test Form',
      items
    }),
    selection
  });
}

function findItem(path: string): FormspecItem | null {
  const segments = path.split('.').filter(Boolean);
  let items = projectSignal.value.definition.items;

  for (let index = 0; index < segments.length; index += 1) {
    const key = segments[index];
    const item = items.find((candidate) => candidate.key === key);
    if (!item) {
      return null;
    }
    if (index === segments.length - 1) {
      return item;
    }
    items = item.children ?? [];
  }

  return null;
}

describe('inspector panel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('routes selection to field inspector', () => {
    seedState([{ type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' }], 'firstName');
    const host = mountApp();

    expect(host.querySelector('[data-testid="field-inspector"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="section-basics"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="section-logic"]')).not.toBeNull();
  });

  it('writes field inspector edits back to project state', async () => {
    seedState([{ type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' }], 'firstName');
    const host = mountApp();

    const labelInput = host.querySelector<HTMLInputElement>('[data-testid="field-label-input"]');
    const hintInput = host.querySelector<HTMLInputElement>('[data-testid="field-hint-input"]');
    const keyInput = host.querySelector<HTMLInputElement>('[data-testid="field-key-input"]');
    const requiredToggle = host.querySelector<HTMLInputElement>('[data-testid="field-required-toggle"]');
    expect(labelInput).not.toBeNull();
    expect(hintInput).not.toBeNull();
    expect(keyInput).not.toBeNull();
    expect(requiredToggle).not.toBeNull();
    if (!labelInput || !hintInput || !keyInput || !requiredToggle) {
      return;
    }

    await act(async () => {
      labelInput.value = 'Applicant Name';
      labelInput.dispatchEvent(new Event('input', { bubbles: true }));
      hintInput.value = 'Use legal full name';
      hintInput.dispatchEvent(new Event('input', { bubbles: true }));
      requiredToggle.click();
      keyInput.value = 'applicantName';
      keyInput.dispatchEvent(new Event('input', { bubbles: true }));
      keyInput.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    expect(findItem('applicantName')?.label).toBe('Applicant Name');
    expect(findItem('applicantName')?.hint).toBe('Use legal full name');
    expect(projectSignal.value.selection).toBe('applicantName');
    const bind = projectSignal.value.definition.binds?.find((entry) => entry.path === 'applicantName');
    expect(bind?.required).toBe(true);
  });

  it('writes responsive overrides from appearance section to component responsive blocks', async () => {
    seedState([{ type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' }], 'firstName');
    const host = mountApp();

    const breakpointInput = host.querySelector<HTMLSelectElement>('[data-testid="field-responsive-breakpoint-input"]');
    const spanInput = host.querySelector<HTMLInputElement>('[data-testid="field-responsive-span-input"]');
    const startInput = host.querySelector<HTMLInputElement>('[data-testid="field-responsive-start-input"]');
    const hiddenToggle = host.querySelector<HTMLInputElement>('[data-testid="field-responsive-hidden-toggle"]');
    expect(breakpointInput).not.toBeNull();
    expect(spanInput).not.toBeNull();
    expect(startInput).not.toBeNull();
    expect(hiddenToggle).not.toBeNull();
    if (!breakpointInput || !spanInput || !startInput || !hiddenToggle) {
      return;
    }

    await act(async () => {
      breakpointInput.value = 'lg';
      breakpointInput.dispatchEvent(new Event('change', { bubbles: true }));
      spanInput.value = '6';
      spanInput.dispatchEvent(new Event('input', { bubbles: true }));
      startInput.value = '3';
      startInput.dispatchEvent(new Event('input', { bubbles: true }));
      hiddenToggle.click();
    });

    expect(projectSignal.value.uiState.activeBreakpoint).toBe('lg');
    const responsive = projectSignal.value.component.tree.children?.[0].responsive as
      | Record<string, Record<string, unknown>>
      | undefined;
    expect(responsive?.lg).toEqual({
      span: 6,
      start: 3,
      hidden: true
    });
  });

  it('filters field widget overrides by data type and writes to component node type', async () => {
    seedState([{ type: 'field', key: 'organizationType', label: 'Organization Type', dataType: 'choice' }], 'organizationType');
    const host = mountApp();

    const widgetInput = host.querySelector<HTMLSelectElement>('[data-testid="field-widget-input"]');
    expect(widgetInput).not.toBeNull();
    if (!widgetInput) {
      return;
    }

    const optionValues = Array.from(widgetInput.querySelectorAll('option')).map((option) => option.value);
    expect(optionValues).toEqual(['', 'Select', 'RadioGroup', 'TextInput']);

    await act(async () => {
      widgetInput.value = 'RadioGroup';
      widgetInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(projectSignal.value.component.tree.children?.[0].component).toBe('RadioGroup');
    expect(projectSignal.value.theme.items?.organizationType).toBeUndefined();
  });

  it('routes selection to group inspector and updates repeat + data table settings', async () => {
    seedState(
      [
        {
          type: 'group',
          key: 'team',
          label: 'Team',
          children: [
            { type: 'field', key: 'memberName', label: 'Member Name', dataType: 'string' },
            { type: 'field', key: 'role', label: 'Role', dataType: 'choice', options: [{ value: 'lead', label: 'Lead' }] }
          ]
        }
      ],
      'team'
    );
    const host = mountApp();

    expect(host.querySelector('[data-testid="group-inspector"]')).not.toBeNull();
    const repeatToggle = host.querySelector<HTMLInputElement>('[data-testid="group-repeatable-toggle"]');
    const minInput = host.querySelector<HTMLInputElement>('[data-testid="group-min-repeat-input"]');
    const displayModeInput = host.querySelector<HTMLSelectElement>('[data-testid="group-display-mode-input"]');
    expect(repeatToggle).not.toBeNull();
    expect(minInput).not.toBeNull();
    expect(displayModeInput).not.toBeNull();
    if (!repeatToggle || !minInput || !displayModeInput) {
      return;
    }

    await act(async () => {
      repeatToggle.click();
      minInput.value = '2';
      minInput.dispatchEvent(new Event('input', { bubbles: true }));
      displayModeInput.value = 'table';
      displayModeInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const roleColumnToggle = host.querySelector<HTMLInputElement>('[data-testid="group-table-column-toggle-role"]');
    const sortToggle = host.querySelector<HTMLInputElement>('[data-testid="group-table-sortable-toggle"]');
    const filterToggle = host.querySelector<HTMLInputElement>('[data-testid="group-table-filterable-toggle"]');
    expect(roleColumnToggle).not.toBeNull();
    expect(sortToggle).not.toBeNull();
    expect(filterToggle).not.toBeNull();
    if (!roleColumnToggle || !sortToggle || !filterToggle) {
      return;
    }

    await act(async () => {
      roleColumnToggle.click();
      sortToggle.click();
      filterToggle.click();
    });

    const sortByInput = host.querySelector<HTMLSelectElement>('[data-testid="group-table-sort-by-input"]');
    expect(sortByInput).not.toBeNull();
    if (!sortByInput) {
      return;
    }

    await act(async () => {
      sortByInput.value = 'memberName';
      sortByInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const group = findItem('team');
    const groupNode = projectSignal.value.component.tree.children?.[0] as Record<string, unknown> | undefined;
    expect(group?.repeatable).toBe(true);
    expect(group?.minRepeat).toBe(2);
    expect(groupNode?.component).toBe('DataTable');
    expect(groupNode?.bind).toBe('team');
    expect(groupNode?.columns).toEqual([{ bind: 'memberName', header: 'Member Name' }]);
    expect(groupNode?.sortable).toBe(true);
    expect(groupNode?.filterable).toBe(true);
    expect(groupNode?.sortBy).toBe('memberName');
  });

  it('renders form inspector with no selection and updates brand + layout settings', async () => {
    seedState([{ type: 'field', key: 'email', label: 'Email', dataType: 'string' }], null);
    const host = mountApp();

    expect(host.querySelector('[data-testid="form-inspector"]')).not.toBeNull();
    const primaryColor = host.querySelector<HTMLInputElement>('[data-testid="brand-primary-color-input"]');
    const pageMode = host.querySelector<HTMLSelectElement>('[data-testid="form-page-mode-input"]');
    expect(primaryColor).not.toBeNull();
    expect(pageMode).not.toBeNull();
    if (!primaryColor || !pageMode) {
      return;
    }

    await act(async () => {
      primaryColor.value = '#123456';
      primaryColor.dispatchEvent(new Event('input', { bubbles: true }));
      pageMode.value = 'wizard';
      pageMode.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(projectSignal.value.theme.tokens?.['color.primary']).toBe('#123456');
    const presentation = projectSignal.value.definition.formPresentation as Record<string, unknown> | undefined;
    expect(presentation?.pageMode).toBe('wizard');
  });

  it('imports a linked sub-form from URL in the form inspector', async () => {
    seedState([], null);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        $formspec: '1.0',
        url: 'https://example.org/forms/address',
        version: '1.2.0',
        title: 'Address Module',
        items: [{ type: 'field', key: 'city', label: 'City', dataType: 'string' }]
      })
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const host = mountApp();
    expect(host.querySelector('[data-testid="section-form-subforms"]')).not.toBeNull();

    const groupKeyInput = host.querySelector<HTMLInputElement>('[data-testid="subform-group-key-input"]');
    const urlInput = host.querySelector<HTMLInputElement>('[data-testid="subform-url-input"]');
    const urlLoadButton = host.querySelector<HTMLButtonElement>('[data-testid="subform-url-load"]');
    expect(groupKeyInput).not.toBeNull();
    expect(urlInput).not.toBeNull();
    expect(urlLoadButton).not.toBeNull();
    if (!groupKeyInput || !urlInput || !urlLoadButton) {
      vi.unstubAllGlobals();
      return;
    }

    await act(async () => {
      groupKeyInput.value = 'address';
      groupKeyInput.dispatchEvent(new Event('input', { bubbles: true }));
      urlInput.value = 'https://example.org/forms/address';
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      urlLoadButton.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(projectSignal.value.definition.items[0]).toEqual(
      expect.objectContaining({
        key: 'address',
        type: 'group'
      })
    );
    expect((projectSignal.value.definition.items[0]?.extensions as Record<string, unknown>)?.['x-linkedSubform']).toEqual(
      expect.objectContaining({
        ref: 'https://example.org/forms/address|1.2.0'
      })
    );

    vi.unstubAllGlobals();
  });

  it('renders variables panel with dependency visibility and persists edits', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        title: 'Variables Form',
        items: [
          { type: 'field', key: 'amount', label: 'Amount', dataType: 'number' },
          { type: 'field', key: 'total', label: 'Total', dataType: 'number' }
        ],
        binds: [{ path: 'total', calculate: '@totalAmount' }],
        variables: [{ name: 'totalAmount', expression: '$amount', scope: '#' }]
      }),
      selection: null
    });
    const host = mountApp();

    expect(host.querySelector('[data-testid="section-form-variables"]')).not.toBeNull();
    expect(host.textContent).toContain('total bind (calculate)');

    const variableAddButton = host.querySelector<HTMLButtonElement>('[data-testid="variable-add-button"]');
    expect(variableAddButton).not.toBeNull();
    if (!variableAddButton) {
      return;
    }

    await act(async () => {
      variableAddButton.click();
    });

    const nameInput = host.querySelector<HTMLInputElement>('[data-testid="variable-name-input"]');
    const expressionInput = host.querySelector<HTMLTextAreaElement>('[data-testid="variable-expression-input"]');
    const scopeInput = host.querySelector<HTMLInputElement>('[data-testid="variable-scope-input"]');
    expect(nameInput).not.toBeNull();
    expect(expressionInput).not.toBeNull();
    expect(scopeInput).not.toBeNull();
    if (!nameInput || !expressionInput || !scopeInput) {
      return;
    }

    await act(async () => {
      nameInput.value = 'amountDoubled';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      expressionInput.value = '@totalAmount * 2';
      expressionInput.dispatchEvent(new Event('input', { bubbles: true }));
      scopeInput.value = '#';
      scopeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(projectSignal.value.definition.variables).toHaveLength(2);
    expect(projectSignal.value.definition.variables?.[1]).toEqual({
      name: 'amountDoubled',
      expression: '@totalAmount * 2'
    });

    expect(host.textContent).toContain('@totalAmount');
  });

  it('renders version panel with classified changes and publishes a new version', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        title: 'Versioned Form',
        version: '1.0.0',
        items: [{ type: 'field', key: 'organizationName', label: 'Organization Name', dataType: 'string' }]
      }),
      selection: null,
      versioning: {
        baselineDefinition: createInitialDefinition({
          title: 'Versioned Form',
          version: '1.0.0',
          items: []
        }),
        releases: []
      }
    });

    const host = mountApp();

    const panel = host.querySelector<HTMLElement>('[data-testid="version-panel"]');
    const impact = host.querySelector<HTMLElement>('[data-testid="version-impact"]');
    const openPublishButton = host.querySelector<HTMLButtonElement>('[data-testid="version-open-publish-dialog"]');
    expect(panel).not.toBeNull();
    expect(impact?.textContent).toContain('minor');
    expect(openPublishButton).not.toBeNull();
    if (!openPublishButton) {
      return;
    }

    await act(async () => {
      openPublishButton.click();
    });

    const bumpInput = host.querySelector<HTMLSelectElement>('[data-testid="publish-bump-input"]');
    const publishButton = host.querySelector<HTMLButtonElement>('[data-testid="publish-confirm-button"]');
    expect(bumpInput).not.toBeNull();
    expect(publishButton).not.toBeNull();
    if (!bumpInput || !publishButton) {
      return;
    }

    await act(async () => {
      bumpInput.value = 'major';
      bumpInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      publishButton.click();
    });

    expect(projectSignal.value.definition.version).toBe('2.0.0');
    expect(projectSignal.value.versioning.releases).toHaveLength(1);
    expect(host.querySelector('[data-testid="publish-dialog"]')).toBeNull();
    expect(host.querySelector('[data-testid="version-last-published"]')?.textContent).toContain('2.0.0');
  });

  it('imports a studio bundle from JSON input in the import/export panel', async () => {
    seedState([{ type: 'field', key: 'legacyField', label: 'Legacy Field', dataType: 'string' }], null);
    const host = mountApp();

    const importedDefinition = createInitialDefinition({
      title: 'Imported Bundle Form',
      url: 'https://example.org/forms/imported-bundle',
      version: '2.4.0',
      items: [{ type: 'field', key: 'projectName', label: 'Project Name', dataType: 'string' }]
    });
    const bundlePayload = {
      $formspecStudioBundle: '1.0',
      exportedAt: '2026-03-05T00:00:00.000Z',
      artifacts: {
        definition: importedDefinition,
        component: createInitialComponent(importedDefinition),
        theme: createInitialTheme(importedDefinition),
        mapping: createInitialMapping(importedDefinition)
      }
    };

    const jsonInput = host.querySelector<HTMLTextAreaElement>('[data-testid="import-export-json-input"]');
    const importButton = host.querySelector<HTMLButtonElement>('[data-testid="import-export-json-apply"]');
    expect(jsonInput).not.toBeNull();
    expect(importButton).not.toBeNull();
    if (!jsonInput || !importButton) {
      return;
    }

    await act(async () => {
      jsonInput.value = JSON.stringify(bundlePayload, null, 2);
      jsonInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      importButton.click();
    });

    expect(projectSignal.value.definition.title).toBe('Imported Bundle Form');
    expect(projectSignal.value.definition.items[0]?.key).toBe('projectName');
    expect(projectSignal.value.mapping.definitionRef).toBe('https://example.org/forms/imported-bundle');
    expect(host.querySelector('[data-testid="import-export-error"]')).toBeNull();
  });

  it('saves and loads form templates from the import/export panel', async () => {
    seedState([{ type: 'field', key: 'fullName', label: 'Full Name', dataType: 'string' }], null);
    const host = mountApp();

    const templateNameInput = host.querySelector<HTMLInputElement>('[data-testid="template-name-input"]');
    const saveTemplateButton = host.querySelector<HTMLButtonElement>('[data-testid="template-save-button"]');
    expect(templateNameInput).not.toBeNull();
    expect(saveTemplateButton).not.toBeNull();
    if (!templateNameInput || !saveTemplateButton) {
      return;
    }

    await act(async () => {
      templateNameInput.value = 'Grant Intake Template';
      templateNameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      saveTemplateButton.click();
    });

    expect(host.querySelector('[data-testid="template-list-empty"]')).toBeNull();

    const formTitleInput = host.querySelector<HTMLInputElement>('[data-testid="form-meta-title-input"]');
    expect(formTitleInput).not.toBeNull();
    if (!formTitleInput) {
      return;
    }

    await act(async () => {
      formTitleInput.value = 'Changed Title';
      formTitleInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(projectSignal.value.definition.title).toBe('Changed Title');

    const loadTemplateButton = host.querySelector<HTMLButtonElement>('[data-testid="template-load-button-0"]');
    expect(loadTemplateButton).not.toBeNull();
    if (!loadTemplateButton) {
      return;
    }

    await act(async () => {
      loadTemplateButton.click();
    });

    expect(projectSignal.value.definition.title).toBe('Inspector Test Form');
    expect(projectSignal.value.definition.items[0]?.key).toBe('fullName');
  });

  it('keeps token editor shell collapsed by default and allows adding a custom token', async () => {
    seedState([{ type: 'field', key: 'email', label: 'Email', dataType: 'string' }], null);
    const host = mountApp();

    expect(host.querySelector('[data-testid="brand-token-key-input"]')).toBeNull();

    const tokenSectionToggle = host.querySelector<HTMLButtonElement>('[data-testid="section-brand-tokens"] .inspector-section__header');
    expect(tokenSectionToggle).not.toBeNull();
    if (!tokenSectionToggle) {
      return;
    }

    await act(async () => {
      tokenSectionToggle.click();
    });

    const keyInput = host.querySelector<HTMLInputElement>('[data-testid="brand-token-key-input"]');
    const valueInput = host.querySelector<HTMLInputElement>('[data-testid="brand-token-value-input"]');
    const addButton = host.querySelector<HTMLButtonElement>('[data-testid="brand-token-add-button"]');
    expect(keyInput).not.toBeNull();
    expect(valueInput).not.toBeNull();
    expect(addButton).not.toBeNull();
    if (!keyInput || !valueInput || !addButton) {
      return;
    }

    await act(async () => {
      keyInput.value = 'color.banner';
      keyInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueInput.value = '#ffeecc';
      valueInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      addButton.click();
    });

    expect(projectSignal.value.theme.tokens?.['color.banner']).toBe('#ffeecc');
  });

  it('edits mapping rules and runs round-trip mapping test UI', async () => {
    seedState([{ type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' }], null);
    const host = mountApp();

    expect(host.querySelector('[data-testid="section-form-mapping"]')).not.toBeNull();

    const directionInput = host.querySelector<HTMLSelectElement>('[data-testid="mapping-direction-input"]');
    const addRuleButton = host.querySelector<HTMLButtonElement>('[data-testid="mapping-rule-add-button"]');
    expect(directionInput).not.toBeNull();
    expect(addRuleButton).not.toBeNull();
    if (!directionInput || !addRuleButton) {
      return;
    }

    await act(async () => {
      directionInput.value = 'both';
      directionInput.dispatchEvent(new Event('change', { bubbles: true }));
      addRuleButton.click();
    });

    const sourceInput = host.querySelector<HTMLInputElement>('[data-testid="mapping-rule-source-1"]');
    const targetInput = host.querySelector<HTMLInputElement>('[data-testid="mapping-rule-target-1"]');
    const transformInput = host.querySelector<HTMLSelectElement>('[data-testid="mapping-rule-transform-1"]');
    expect(sourceInput).not.toBeNull();
    expect(targetInput).not.toBeNull();
    expect(transformInput).not.toBeNull();
    if (!sourceInput || !targetInput || !transformInput) {
      return;
    }

    await act(async () => {
      sourceInput.value = 'firstName';
      sourceInput.dispatchEvent(new Event('input', { bubbles: true }));

      targetInput.value = 'person.name';
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));

      transformInput.value = 'coerce';
      transformInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const coerceInput = host.querySelector<HTMLSelectElement>('[data-testid="mapping-rule-coerce-input"]');
    expect(coerceInput).not.toBeNull();
    if (!coerceInput) {
      return;
    }

    await act(async () => {
      coerceInput.value = 'string';
      coerceInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(projectSignal.value.mapping.rules[1]).toEqual(
      expect.objectContaining({
        sourcePath: 'firstName',
        targetPath: 'person.name',
        transform: 'coerce',
        coerce: 'string'
      })
    );

    const sampleInput = host.querySelector<HTMLTextAreaElement>('[data-testid="mapping-roundtrip-source-input"]');
    const runButton = host.querySelector<HTMLButtonElement>('[data-testid="mapping-roundtrip-run-button"]');
    expect(sampleInput).not.toBeNull();
    expect(runButton).not.toBeNull();
    if (!sampleInput || !runButton) {
      return;
    }

    await act(async () => {
      sampleInput.value = '{\"firstName\":\"Ada\"}';
      sampleInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      runButton.click();
    });

    const summary = host.querySelector<HTMLElement>('[data-testid="mapping-roundtrip-diff-summary"]');
    const forwardOutput = host.querySelector<HTMLElement>('[data-testid="mapping-roundtrip-forward-output"]');
    expect(summary?.textContent).toContain('Round-trip matched input payload.');
    expect(forwardOutput?.textContent).toContain('person');
    expect(forwardOutput?.textContent).toContain('Ada');
  });

  it('loads extension registries and exposes custom entries in editor workflows', async () => {
    seedState([{ type: 'field', key: 'email', label: 'Email', dataType: 'string' }], null);
    const host = mountApp();

    const registryPayload = {
      $formspecRegistry: '1.0',
      publisher: {
        name: 'Acme Extensions',
        url: 'https://acme.example'
      },
      published: '2026-03-01T00:00:00Z',
      entries: [
        {
          name: 'x-acme-customer-id',
          category: 'dataType',
          version: '1.0.0',
          status: 'stable',
          description: 'Customer identifier',
          compatibility: {
            formspecVersion: '>=1.0.0 <2.0.0'
          },
          baseType: 'string',
          metadata: {
            displayName: 'Customer ID'
          }
        },
        {
          name: 'x-acme-risk-score',
          category: 'function',
          version: '1.0.0',
          status: 'stable',
          description: 'Calculates a risk score.',
          compatibility: {
            formspecVersion: '>=1.0.0 <2.0.0'
          },
          parameters: [{ name: 'amount', type: 'number' }],
          returns: 'number'
        },
        {
          name: 'x-acme-unique',
          category: 'constraint',
          version: '1.0.0',
          status: 'deprecated',
          description: 'Validates uniqueness.',
          compatibility: {
            formspecVersion: '>=1.0.0 <2.0.0'
          },
          parameters: [{ name: 'value', type: 'string' }],
          deprecationNotice: 'Use x-acme-unique-v2.'
        }
      ]
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => registryPayload
    });
    vi.stubGlobal('fetch', fetchMock);

    const urlInput = host.querySelector<HTMLInputElement>('[data-testid="extension-registry-url-input"]');
    const loadButton = host.querySelector<HTMLButtonElement>('[data-testid="extension-registry-url-load"]');
    expect(urlInput).not.toBeNull();
    expect(loadButton).not.toBeNull();
    if (!urlInput || !loadButton) {
      vi.unstubAllGlobals();
      return;
    }

    await act(async () => {
      urlInput.value = 'https://example.org/registry.json';
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      loadButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.org/registry.json',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json'
        })
      })
    );
    expect(projectSignal.value.extensions.registries).toHaveLength(1);
    expect(host.querySelector('[data-testid="extension-summary-datatypes"]')?.textContent).toContain('1');
    expect(host.querySelector('[data-testid="extension-summary-functions"]')?.textContent).toContain('1');
    expect(host.querySelector('[data-testid="extension-summary-constraints"]')?.textContent).toContain('1');
    expect(host.querySelector('[data-testid="extension-entry-status-x-acme-unique"]')?.textContent).toContain(
      'deprecated'
    );

    const fieldItem = host.querySelector<HTMLElement>('[data-testid="surface-item-email"]');
    expect(fieldItem).not.toBeNull();
    if (!fieldItem) {
      vi.unstubAllGlobals();
      return;
    }

    await act(async () => {
      fieldItem.click();
    });

    const customConstraintSelect = host.querySelector<HTMLSelectElement>('[data-testid="field-custom-constraint-input"]');
    const customConstraintApply = host.querySelector<HTMLButtonElement>('[data-testid="field-custom-constraint-apply"]');
    expect(customConstraintSelect).not.toBeNull();
    expect(customConstraintApply).not.toBeNull();
    if (!customConstraintSelect || !customConstraintApply) {
      vi.unstubAllGlobals();
      return;
    }

    await act(async () => {
      customConstraintSelect.value = 'x-acme-unique';
      customConstraintSelect.dispatchEvent(new Event('change', { bubbles: true }));
      customConstraintApply.click();
    });

    const bind = projectSignal.value.definition.binds?.find((entry) => entry.path === 'email');
    expect(bind?.constraint).toBe('x_acme_unique($)');

    const addBetweenButton = host.querySelector<HTMLButtonElement>('[data-testid="add-between-root-1"]');
    expect(addBetweenButton).not.toBeNull();
    if (!addBetweenButton) {
      vi.unstubAllGlobals();
      return;
    }

    await act(async () => {
      addBetweenButton.click();
    });

    const customTemplate = host.querySelector<HTMLButtonElement>(
      '[data-testid="slash-template-extension-x-acme-customer-id"]'
    );
    expect(customTemplate).not.toBeNull();
    if (!customTemplate) {
      vi.unstubAllGlobals();
      return;
    }

    await act(async () => {
      customTemplate.click();
    });

    expect(
      projectSignal.value.definition.items.some(
        (item) => item.extensions && item.extensions['x-acme-customer-id'] === true
      )
    ).toBe(true);

    vi.unstubAllGlobals();
  });

  it('renders grouped token categories with previews and usage references', async () => {
    const definition = createInitialDefinition({
      title: 'Theme Tokens',
      items: [{ type: 'field', key: 'email', label: 'Email', dataType: 'string' }]
    });
    projectSignal.value = createInitialProjectState({
      definition,
      selection: null,
      theme: {
        ...createInitialTheme(definition),
        tokens: {
          'color.primary': '#0057b7',
          'spacing.md': '16px',
          'typography.body.family': 'IBM Plex Sans, sans-serif'
        },
        selectors: [
          {
            match: { type: 'field' },
            apply: {
              style: {
                borderColor: '$token.color.primary'
              }
            }
          }
        ],
        items: {
          email: {
            style: {
              marginBlock: '$token.spacing.md',
              fontFamily: '$token.typography.body.family'
            }
          }
        }
      }
    });

    const host = mountApp();
    const tokenSectionToggle = host.querySelector<HTMLButtonElement>('[data-testid="section-brand-tokens"] .inspector-section__header');
    expect(tokenSectionToggle).not.toBeNull();
    if (!tokenSectionToggle) {
      return;
    }

    await act(async () => {
      tokenSectionToggle.click();
    });

    expect(host.querySelector('[data-testid="brand-token-group-color"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="brand-token-group-spacing"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="brand-token-group-typography"]')).not.toBeNull();

    expect(host.querySelector('[data-testid="brand-token-preview-color.primary"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="brand-token-preview-spacing.md"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="brand-token-preview-typography.body.family"]')).not.toBeNull();

    const colorRefs = host.querySelector('[data-testid="brand-token-refs-color.primary"]');
    const spacingRefs = host.querySelector('[data-testid="brand-token-refs-spacing.md"]');
    const typographyRefs = host.querySelector('[data-testid="brand-token-refs-typography.body.family"]');
    expect(colorRefs?.textContent).toContain('selectors[0].apply.style.borderColor');
    expect(spacingRefs?.textContent).toContain('items.email.style.marginBlock');
    expect(typographyRefs?.textContent).toContain('items.email.style.fontFamily');
  });

  it('edits theme selector rules from the style rules section', async () => {
    seedState([{ type: 'field', key: 'startDate', label: 'Start Date', dataType: 'date' }], null);
    const host = mountApp();

    const addRule = host.querySelector<HTMLButtonElement>('[data-testid="selector-rule-add-button"]');
    expect(addRule).not.toBeNull();
    if (!addRule) {
      return;
    }

    await act(async () => {
      addRule.click();
    });

    const typeInput = host.querySelector<HTMLSelectElement>('[data-testid="selector-rule-type-0"]');
    const dataTypeInput = host.querySelector<HTMLSelectElement>('[data-testid="selector-rule-data-type-0"]');
    const widgetInput = host.querySelector<HTMLSelectElement>('[data-testid="selector-rule-widget-0"]');
    const cssClassInput = host.querySelector<HTMLInputElement>('[data-testid="selector-rule-css-class-0"]');
    const removeRule = host.querySelector<HTMLButtonElement>('[data-testid="selector-rule-remove-0"]');
    expect(typeInput).not.toBeNull();
    expect(dataTypeInput).not.toBeNull();
    expect(widgetInput).not.toBeNull();
    expect(cssClassInput).not.toBeNull();
    expect(removeRule).not.toBeNull();
    if (!typeInput || !dataTypeInput || !widgetInput || !cssClassInput || !removeRule) {
      return;
    }

    await act(async () => {
      typeInput.value = 'field';
      typeInput.dispatchEvent(new Event('change', { bubbles: true }));

      dataTypeInput.value = 'date';
      dataTypeInput.dispatchEvent(new Event('change', { bubbles: true }));

      widgetInput.value = 'datePicker';
      widgetInput.dispatchEvent(new Event('change', { bubbles: true }));

      cssClassInput.value = 'compact-date';
      cssClassInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(projectSignal.value.theme.selectors).toEqual([
      {
        match: {
          type: 'field',
          dataType: 'date'
        },
        apply: {
          widget: 'datePicker',
          cssClass: 'compact-date'
        }
      }
    ]);

    await act(async () => {
      removeRule.click();
    });

    expect(projectSignal.value.theme.selectors).toEqual([]);
  });

  it('builds form rules (shapes) with composition editing', async () => {
    seedState(
      [
        { type: 'field', key: 'totalBudget', label: 'Total Budget', dataType: 'number' },
        { type: 'field', key: 'awardAmount', label: 'Award Amount', dataType: 'number' }
      ],
      null
    );
    const host = mountApp();

    const addRule = host.querySelector<HTMLButtonElement>('[data-testid="shape-add-button"]');
    expect(addRule).not.toBeNull();
    if (!addRule) {
      return;
    }

    await act(async () => {
      addRule.click();
    });

    const nameInput = host.querySelector<HTMLInputElement>('[data-testid="shape-name-input"]');
    expect(nameInput).not.toBeNull();
    if (!nameInput) {
      return;
    }

    await act(async () => {
      nameInput.value = 'Budget aligns';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const targetMode = host.querySelector<HTMLSelectElement>('[data-testid="shape-target-mode-input"]');
    expect(targetMode).not.toBeNull();
    if (!targetMode) {
      return;
    }

    await act(async () => {
      targetMode.value = 'field';
      targetMode.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const targetField = host.querySelector<HTMLSelectElement>('[data-testid="shape-target-field-input"]');
    expect(targetField).not.toBeNull();
    if (!targetField) {
      return;
    }

    await act(async () => {
      targetField.value = 'totalBudget';
      targetField.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const constraintInput = host.querySelector<HTMLTextAreaElement>('[data-testid="shape-constraint-input"]');
    const messageInput = host.querySelector<HTMLInputElement>('[data-testid="shape-message-input"]');
    const compositionMode = host.querySelector<HTMLSelectElement>('[data-testid="shape-composition-mode-input"]');
    expect(constraintInput).not.toBeNull();
    expect(messageInput).not.toBeNull();
    expect(compositionMode).not.toBeNull();
    if (!constraintInput || !messageInput || !compositionMode) {
      return;
    }

    await act(async () => {
      constraintInput.value = '$totalBudget = $awardAmount';
      constraintInput.dispatchEvent(new Event('input', { bubbles: true }));

      messageInput.value = 'Budget must equal award amount.';
      messageInput.dispatchEvent(new Event('input', { bubbles: true }));

      compositionMode.value = 'and';
      compositionMode.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const compositionExpressionInput = host.querySelector<HTMLTextAreaElement>(
      '[data-testid="shape-composition-entry-expression-0"]'
    );
    expect(compositionExpressionInput).not.toBeNull();
    if (!compositionExpressionInput) {
      return;
    }

    await act(async () => {
      compositionExpressionInput.value = 'present($totalBudget)';
      compositionExpressionInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const shape = projectSignal.value.definition.shapes?.find((entry) => entry.id === 'budget-aligns');
    expect(shape).toBeDefined();
    expect(shape?.target).toBe('totalBudget');
    expect(shape?.constraint).toBe('$totalBudget = $awardAmount');
    expect(shape?.message).toBe('Budget must equal award amount.');
    expect(shape?.and).toEqual(['present($totalBudget)']);
  });
});
