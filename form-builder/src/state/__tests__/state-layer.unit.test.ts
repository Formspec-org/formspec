import { describe, expect, it } from 'vitest';
import { createProjectSignal } from '../project';
import {
  addItem,
  addVariable,
  addThemeSelector,
  addShape,
  deleteItem,
  deleteVariable,
  deleteThemeSelector,
  deleteShape,
  moveItem,
  renameItem,
  renameShapeId,
  setComponentResponsiveOverride,
  setBind,
  setPreviewWidth,
  setFormPresentationProperty,
  setVariableExpression,
  setVariableName,
  setVariableScope,
  setThemeSelectorApplyProperty,
  setThemeSelectorMatchProperty,
  setShapeComposition,
  setShapeProperty,
  setFieldWidgetComponent,
  setGroupDataTableConfig,
  setGroupDisplayMode,
  setThemeBreakpoint,
  setThemeToken,
  addMappingRule,
  deleteMappingRule,
  importSubform,
  setMappingProperty,
  setMappingRuleProperty,
  setMappingTargetSchemaProperty,
  publishVersion
} from '../mutations';
import { createDerivedSignals } from '../derived';
import { generateDefinitionChangelog } from '../versioning';

function expectStructurallyValid(project = createProjectSignal()) {
  const derived = createDerivedSignals(project);
  expect(derived.structuralDiagnostics.value.definition.valid).toBe(true);
  expect(derived.structuralDiagnostics.value.component.valid).toBe(true);
  expect(derived.structuralDiagnostics.value.theme.valid).toBe(true);
  expect(derived.structuralDiagnostics.value.mapping.valid).toBe(true);
}

describe('project state layer', () => {
  it('creates a structurally valid initial project', () => {
    const project = createProjectSignal();
    expectStructurallyValid(project);

    const derived = createDerivedSignals(project);
    expect(derived.fieldPaths.value).toEqual([]);
    expect(derived.engineState.value.error).toBeNull();
  });

  it('adds a field and keeps definition/component/theme valid', () => {
    const project = createProjectSignal();

    addItem(project, {
      type: 'field',
      dataType: 'string',
      key: 'applicantName',
      label: 'Applicant Name'
    });

    expect(project.value.definition.items).toHaveLength(1);
    expect(project.value.component.tree.component).toBe('Stack');
    expect(project.value.component.tree.children).toEqual([
      { component: 'TextInput', bind: 'applicantName' }
    ]);
    expect(project.value.selection).toBe('applicantName');

    expectStructurallyValid(project);
  });

  it('renames an item and rewrites bind paths and FEL references', () => {
    const project = createProjectSignal();
    addItem(project, { type: 'field', dataType: 'string', key: 'budget', label: 'Budget' });
    addItem(project, { type: 'field', dataType: 'string', key: 'total', label: 'Total' });

    setBind(project, 'total', 'calculate', 'budget');
    setBind(project, 'total', 'constraint', 'budget != ""');

    renameItem(project, 'budget', 'projectBudget');

    const totalBind = project.value.definition.binds?.find((bind) => bind.path === 'total');
    expect(totalBind?.calculate).toBe('projectBudget');
    expect(totalBind?.constraint).toBe('projectBudget != ""');

    expect(project.value.component.tree.children).toEqual([
      { component: 'TextInput', bind: 'projectBudget' },
      { component: 'TextInput', bind: 'total' }
    ]);

    expectStructurallyValid(project);
  });

  it('adds variables and rewrites variable field dependencies on rename', () => {
    const project = createProjectSignal();
    addItem(project, { type: 'field', dataType: 'decimal', key: 'amount', label: 'Amount' });
    addItem(project, { type: 'field', dataType: 'decimal', key: 'total', label: 'Total' });

    const variableIndex = addVariable(project, {
      name: 'baseAmount',
      expression: '$amount'
    });
    setBind(project, 'total', 'calculate', '@baseAmount * 2');

    const beforeRenameDependencies = createDerivedSignals(project).variableDependencies.value;
    expect(beforeRenameDependencies[0]?.dependsOnFields).toEqual(['amount']);
    expect(beforeRenameDependencies[0]?.usedBy.map((usage) => usage.label)).toContain('total bind (calculate)');

    renameItem(project, 'amount', 'projectAmount');

    expect(project.value.definition.variables?.[variableIndex]?.expression).toBe('$projectAmount');

    const afterRenameDependencies = createDerivedSignals(project).variableDependencies.value;
    expect(afterRenameDependencies[0]?.dependsOnFields).toEqual(['projectAmount']);
    expectStructurallyValid(project);
  });

  it('supports editing variable properties and deleting variables', () => {
    const project = createProjectSignal();
    addItem(project, { type: 'field', dataType: 'decimal', key: 'amount', label: 'Amount' });

    const firstIndex = addVariable(project, { name: 'baseAmount', expression: '$amount' });
    const secondIndex = addVariable(project, { name: 'scopedValue', expression: '@baseAmount', scope: 'amount' });

    setVariableName(project, firstIndex, 'baseTotal');
    setVariableExpression(project, secondIndex, '@baseTotal');
    setVariableScope(project, secondIndex, '#');

    expect(project.value.definition.variables?.[firstIndex]?.name).toBe('baseTotal');
    expect(project.value.definition.variables?.[secondIndex]?.expression).toBe('@baseTotal');
    expect(project.value.definition.variables?.[secondIndex]?.scope).toBeUndefined();

    deleteVariable(project, firstIndex);
    expect(project.value.definition.variables).toHaveLength(1);
    expect(project.value.definition.variables?.[0]?.name).toBe('scopedValue');

    expectStructurallyValid(project);
  });

  it('removes variables scoped to deleted items', () => {
    const project = createProjectSignal();
    addItem(project, { type: 'group', key: 'budget', label: 'Budget' });
    addItem(project, { type: 'field', dataType: 'decimal', key: 'amount', label: 'Amount', parentPath: 'budget' });

    addVariable(project, { name: 'formTotal', expression: '$budget.amount', scope: '#' });
    addVariable(project, { name: 'groupTotal', expression: '$amount', scope: 'budget' });
    expect(project.value.definition.variables).toHaveLength(2);

    deleteItem(project, 'budget');

    expect(project.value.definition.variables).toEqual([
      {
        name: 'formTotal',
        expression: '$budget.amount'
      }
    ]);
    expectStructurallyValid(project);
  });

  it('moves an item into a group and rewrites descendant paths', () => {
    const project = createProjectSignal();

    addItem(project, { type: 'group', key: 'applicant', label: 'Applicant' });
    addItem(project, { type: 'field', dataType: 'string', key: 'name', label: 'Name' });
    addItem(project, { type: 'field', dataType: 'string', key: 'nickname', label: 'Nickname' });

    setBind(project, 'nickname', 'calculate', 'name');

    moveItem(project, 'name', { parentPath: 'applicant', index: 0 });

    expect(project.value.definition.binds?.find((bind) => bind.path === 'nickname')?.calculate).toBe('applicant.name');
    expect(project.value.component.tree.children).toEqual([
      {
        component: 'Stack',
        children: [{ component: 'TextInput', bind: 'applicant.name' }]
      },
      { component: 'TextInput', bind: 'nickname' }
    ]);

    expectStructurallyValid(project);
  });

  it('reorders items within the same parent when moving down', () => {
    const project = createProjectSignal();

    addItem(project, { type: 'field', dataType: 'string', key: 'firstName', label: 'First Name' });
    addItem(project, { type: 'field', dataType: 'string', key: 'lastName', label: 'Last Name' });
    addItem(project, { type: 'field', dataType: 'string', key: 'email', label: 'Email' });

    moveItem(project, 'firstName', { parentPath: null, index: 3 });

    expect(project.value.definition.items.map((item) => item.key)).toEqual(['lastName', 'email', 'firstName']);
    expect(project.value.component.tree.children).toEqual([
      { component: 'TextInput', bind: 'lastName' },
      { component: 'TextInput', bind: 'email' },
      { component: 'TextInput', bind: 'firstName' }
    ]);

    expectStructurallyValid(project);
  });

  it('writes brand tokens and form presentation properties while keeping documents valid', () => {
    const project = createProjectSignal();

    setThemeToken(project, 'color.primary', '#0057b7');
    setThemeToken(project, 'typography.body.family', 'IBM Plex Sans, sans-serif');
    setFormPresentationProperty(project, 'pageMode', 'wizard');
    setFormPresentationProperty(project, 'defaultCurrency', 'USD');

    expect(project.value.theme.tokens?.['color.primary']).toBe('#0057b7');
    expect(project.value.theme.tokens?.['typography.body.family']).toBe('IBM Plex Sans, sans-serif');
    expect((project.value.definition.formPresentation as Record<string, unknown> | undefined)?.pageMode).toBe('wizard');
    expect((project.value.definition.formPresentation as Record<string, unknown> | undefined)?.defaultCurrency).toBe('USD');

    expectStructurallyValid(project);
  });

  it('updates responsive breakpoints and component overrides while keeping documents valid', () => {
    const project = createProjectSignal();
    addItem(project, { type: 'field', dataType: 'string', key: 'organization', label: 'Organization' });

    setThemeBreakpoint(project, 'md', 820);
    setPreviewWidth(project, 900);
    setComponentResponsiveOverride(project, 'organization', 'md', {
      span: 6,
      start: 3,
      hidden: true
    });

    expect(project.value.theme.breakpoints?.md).toBe(820);
    expect(project.value.component.breakpoints?.md).toBe(820);
    expect(project.value.uiState.activeBreakpoint).toBe('md');
    expect((project.value.component.tree.children?.[0].responsive as Record<string, Record<string, unknown>>)?.md).toEqual({
      span: 6,
      start: 3,
      hidden: true
    });

    expectStructurallyValid(project);
  });

  it('adds and edits theme selector rules while keeping documents valid', () => {
    const project = createProjectSignal();

    const selectorIndex = addThemeSelector(project, {
      match: { type: 'field', dataType: 'date' },
      apply: { widget: 'datePicker' }
    });

    setThemeSelectorApplyProperty(project, selectorIndex, 'cssClass', 'compact-date');
    setThemeSelectorApplyProperty(project, selectorIndex, 'labelPosition', 'top');
    setThemeSelectorMatchProperty(project, selectorIndex, 'type', '');
    setThemeSelectorMatchProperty(project, selectorIndex, 'dataType', '');

    expect(project.value.theme.selectors).toEqual([
      {
        match: { type: 'field' },
        apply: {
          widget: 'datePicker',
          cssClass: 'compact-date',
          labelPosition: 'top'
        }
      }
    ]);

    deleteThemeSelector(project, selectorIndex);
    expect(project.value.theme.selectors).toEqual([]);

    expectStructurallyValid(project);
  });

  it('updates field widget override by writing component node type', () => {
    const project = createProjectSignal();
    addItem(project, { type: 'field', dataType: 'choice', key: 'organizationType', label: 'Organization Type' });

    expect(project.value.component.tree.children?.[0].component).toBe('Select');

    setFieldWidgetComponent(project, 'organizationType', 'RadioGroup');
    expect(project.value.component.tree.children?.[0].component).toBe('RadioGroup');

    setFieldWidgetComponent(project, 'organizationType', '');
    expect(project.value.component.tree.children?.[0].component).toBe('Select');

    expectStructurallyValid(project);
  });

  it('configures repeating groups to use data table mode with column + sort options', () => {
    const project = createProjectSignal();
    addItem(project, { type: 'group', key: 'lineItems', label: 'Line Items' });
    addItem(project, { type: 'field', dataType: 'string', key: 'description', label: 'Description', parentPath: 'lineItems' });
    addItem(project, { type: 'field', dataType: 'number', key: 'amount', label: 'Amount', parentPath: 'lineItems' });

    setGroupDisplayMode(project, 'lineItems', 'table');
    setGroupDataTableConfig(project, 'lineItems', {
      columns: [{ bind: 'amount', header: 'Amount' }],
      showRowNumbers: true,
      allowAdd: true,
      allowRemove: true,
      sortable: true,
      filterable: true,
      sortBy: 'amount',
      sortDirection: 'desc'
    });

    const group = project.value.definition.items[0];
    const node = project.value.component.tree.children?.[0] as Record<string, unknown> | undefined;

    expect(group?.repeatable).toBe(true);
    expect(node?.component).toBe('DataTable');
    expect(node?.bind).toBe('lineItems');
    expect(node?.columns).toEqual([{ bind: 'amount', header: 'Amount' }]);
    expect(node?.sortable).toBe(true);
    expect(node?.filterable).toBe(true);
    expect(node?.sortBy).toBe('amount');
    expect(node?.sortDirection).toBe('desc');

    setGroupDisplayMode(project, 'lineItems', 'stack');
    expect((project.value.component.tree.children?.[0] as Record<string, unknown> | undefined)?.component).toBe('Stack');

    expectStructurallyValid(project);
  });

  it('adds and edits shapes with composition while keeping documents valid', () => {
    const project = createProjectSignal();
    addItem(project, { type: 'field', dataType: 'number', key: 'totalBudget', label: 'Total Budget' });
    addItem(project, { type: 'field', dataType: 'number', key: 'awardAmount', label: 'Award Amount' });

    const shapeId = addShape(project, { name: 'Budget matches award' });
    setShapeProperty(project, shapeId, 'target', 'totalBudget');
    setShapeProperty(project, shapeId, 'constraint', '$totalBudget = $awardAmount');
    setShapeProperty(project, shapeId, 'message', 'Budget must match award amount.');
    setShapeComposition(project, shapeId, 'and', ['present($totalBudget)', 'present($awardAmount)']);

    const shape = project.value.definition.shapes?.find((entry) => entry.id === shapeId);
    expect(shape).toBeDefined();
    expect(shape?.target).toBe('totalBudget');
    expect(shape?.and).toEqual(['present($totalBudget)', 'present($awardAmount)']);

    expectStructurallyValid(project);
  });

  it('renames and deletes shapes while rewriting composition references', () => {
    const project = createProjectSignal();

    const firstId = addShape(project, { name: 'base rule' });
    const secondId = addShape(project, { name: 'dependent rule' });
    setShapeComposition(project, secondId, 'or', [firstId, 'present($amount)']);

    const renamedFirstId = renameShapeId(project, firstId, 'Base Rule Renamed');
    const dependent = project.value.definition.shapes?.find((shape) => shape.id === secondId);
    expect(dependent?.or).toContain(renamedFirstId);

    deleteShape(project, renamedFirstId);
    const dependentAfterDelete = project.value.definition.shapes?.find((shape) => shape.id === secondId);
    expect(dependentAfterDelete?.or).toEqual(['present($amount)']);

    expectStructurallyValid(project);
  });

  it('edits mapping metadata and rules while keeping mapping structurally valid', () => {
    const project = createProjectSignal();
    addItem(project, { type: 'field', dataType: 'string', key: 'firstName', label: 'First Name' });

    setMappingProperty(project, 'direction', 'both');
    setMappingTargetSchemaProperty(project, 'format', 'json');
    setMappingTargetSchemaProperty(project, 'name', 'CRM Payload');

    const firstRuleIndex = addMappingRule(project, {
      sourcePath: 'firstName',
      targetPath: 'person.givenName',
      transform: 'preserve',
      bidirectional: true
    });
    setMappingRuleProperty(project, firstRuleIndex, 'transform', 'coerce');
    setMappingRuleProperty(project, firstRuleIndex, 'coerce', 'string');
    setMappingRuleProperty(project, firstRuleIndex, 'priority', 10);

    const secondRuleIndex = addMappingRule(project, {
      sourcePath: 'firstName',
      targetPath: 'person.type',
      transform: 'constant'
    });
    setMappingRuleProperty(project, secondRuleIndex, 'expression', "'person'");
    setMappingRuleProperty(project, secondRuleIndex, 'bidirectional', false);

    deleteMappingRule(project, 0);

    expect(project.value.mapping.definitionRef).toBe(project.value.definition.url);
    expect(project.value.mapping.direction).toBe('both');
    expect(project.value.mapping.targetSchema.format).toBe('json');
    expect(project.value.mapping.targetSchema.name).toBe('CRM Payload');
    expect(project.value.mapping.rules).toHaveLength(2);
    expect(project.value.mapping.rules[0]).toEqual(
      expect.objectContaining({
        sourcePath: 'firstName',
        targetPath: 'person.givenName',
        transform: 'coerce',
        coerce: 'string',
        priority: 10
      })
    );
    expect(project.value.mapping.rules[1]).toEqual(
      expect.objectContaining({
        sourcePath: 'firstName',
        targetPath: 'person.type',
        transform: 'constant',
        expression: "'person'",
        bidirectional: false
      })
    );

    expectStructurallyValid(project);
  });

  it('imports a linked sub-form via $ref assembly and rewrites imported binds', () => {
    const project = createProjectSignal();

    importSubform(project, {
      payload: {
        $formspec: '1.0',
        url: 'https://example.org/forms/budget',
        version: '2.0.0',
        title: 'Budget Module',
        items: [
          { type: 'field', key: 'amount', label: 'Amount', dataType: 'decimal' },
          { type: 'field', key: 'tax', label: 'Tax', dataType: 'decimal' }
        ],
        binds: [{ path: 'tax', calculate: '$amount * 0.1' }]
      },
      groupKey: 'financials',
      groupLabel: 'Financials',
      keyPrefix: 'budget_'
    });

    const importedGroup = project.value.definition.items[0];
    expect(importedGroup?.type).toBe('group');
    expect(importedGroup?.key).toBe('financials');
    expect(importedGroup?.children?.map((item) => item.key)).toEqual(['budget_amount', 'budget_tax']);
    expect(importedGroup?.extensions?.['x-linkedSubform']).toEqual(
      expect.objectContaining({
        ref: 'https://example.org/forms/budget|2.0.0',
        keyPrefix: 'budget_'
      })
    );

    const importedBind = project.value.definition.binds?.find((bind) => bind.path === 'financials.budget_tax');
    expect(importedBind?.calculate).toContain('budget_amount');

    expect(project.value.selection).toBe('financials');
    expectStructurallyValid(project);
  });

  it('computes a breaking pending changelog when an item is removed after publish baseline', () => {
    const project = createProjectSignal();
    addItem(project, { type: 'field', dataType: 'string', key: 'orgName', label: 'Organization Name' });
    publishVersion(project, { bump: 'minor', generatedAt: '2026-03-05T00:00:00.000Z' });

    deleteItem(project, 'orgName');

    const pending = generateDefinitionChangelog(
      project.value.versioning.baselineDefinition,
      project.value.definition,
      project.value.definition.url
    );
    expect(pending.semverImpact).toBe('major');
    expect(pending.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'removed',
          target: 'item',
          impact: 'breaking',
          path: 'items.orgName'
        })
      ])
    );
  });

  it('publishes version, records changelog, and resets pending diff', () => {
    const project = createProjectSignal();
    addItem(project, { type: 'field', dataType: 'string', key: 'orgType', label: 'Organization Type' });

    const changelog = publishVersion(project, {
      bump: 'minor',
      summary: 'Add organization type',
      generatedAt: '2026-03-05T00:00:00.000Z'
    });

    expect(project.value.definition.version).toBe('1.1.0');
    expect(project.value.component.version).toBe('1.1.0');
    expect(project.value.theme.version).toBe('1.1.0');
    expect(project.value.mapping.definitionVersion).toBe('1.1.0');
    expect(project.value.versioning.releases).toHaveLength(1);
    expect(project.value.versioning.releases[0]).toEqual(
      expect.objectContaining({
        version: '1.1.0',
        publishedAt: '2026-03-05T00:00:00.000Z',
        changelog
      })
    );
    expect(changelog.summary).toBe('Add organization type');
    expect(changelog.semverImpact).toBe('minor');

    const pendingAfterPublish = generateDefinitionChangelog(
      project.value.versioning.baselineDefinition,
      project.value.definition,
      project.value.definition.url
    );
    expect(pendingAfterPublish.changes).toHaveLength(0);
    expect(pendingAfterPublish.semverImpact).toBe('patch');

    expectStructurallyValid(project);
  });
});
