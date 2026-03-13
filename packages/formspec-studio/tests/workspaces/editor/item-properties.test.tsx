import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject, type Project } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../../src/state/useSelection';
import { ItemProperties } from '../../../src/workspaces/editor/ItemProperties';

const testDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'group1', type: 'group', label: 'Section', children: [
      { key: 'email', type: 'field', dataType: 'string' },
    ]},
    {
      key: 'status', type: 'field', dataType: 'choice', label: 'Status',
      options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
    },
  ],
  binds: [{ path: 'name', required: 'true' }],
};

/** Minimal component tree matching testDef items. */
const testComponent = {
  targetDefinition: { url: 'urn:test' },
  tree: {
    component: 'Stack', nodeId: 'root', children: [
      { component: 'TextInput', bind: 'name' },
      { component: 'Stack', bind: 'group1', children: [
        { component: 'TextInput', bind: 'email' },
      ]},
      { component: 'Select', bind: 'status' },
    ],
  },
};

function SelectAndInspect({ path, type }: { path: string; type: string }) {
  const { select } = useSelection();
  return (
    <>
      <button onClick={() => select(path, type)}>Select</button>
      <ItemProperties />
    </>
  );
}

function renderProps(project?: Project, selection: { path: string; type: string } = { path: 'name', type: 'field' }) {
  const p = project ?? createProject({ seed: { definition: testDef as any, component: testComponent as any } });
  return {
    ...render(
      <ProjectProvider project={p}>
        <SelectionProvider>
          <SelectAndInspect path={selection.path} type={selection.type} />
        </SelectionProvider>
      </ProjectProvider>
    ),
    project: p,
  };
}

describe('ItemProperties', () => {
  it('shows definition properties when nothing selected', () => {
    const project = createProject({ seed: { definition: testDef as any } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ItemProperties />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByText(/form properties/i)).toBeInTheDocument();
  });

  it('shows item details when selected', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByDisplayValue('name')).toBeInTheDocument();
    expect(screen.getByText(/string/i)).toBeInTheDocument();
  });

  it('dispatches rename on key change', async () => {
    const { project } = renderProps();
    const spy = vi.spyOn(project, 'dispatch');

    await act(async () => { screen.getByText('Select').click(); });

    const input = screen.getByDisplayValue('name');
    await act(async () => {
      // Simulate changing the key
      (input as HTMLInputElement).value = 'fullName';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Should dispatch on blur
    await act(async () => {
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'definition.renameItem' })
    );
  });

  it('shows delete button', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows duplicate button', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument();
  });

  it('shows behavior rules for exact nested bind paths', async () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        {
          key: 'household',
          type: 'group',
          label: 'Household',
          children: [{ key: 'hhSize', type: 'field', dataType: 'integer' }],
        },
      ],
      binds: [{ path: 'household.hhSize', required: 'count(.) > 0' }],
    } as any } });
    renderProps(project, { path: 'household.hhSize', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/behavior rules/i)).toBeInTheDocument();
    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });

  it('does not show behavior rules for nested fields when only a leaf-key bind exists', async () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        {
          key: 'household',
          type: 'group',
          label: 'Household',
          children: [{ key: 'hhSize', type: 'field', dataType: 'integer' }],
        },
      ],
      binds: [{ path: 'hhSize', required: 'count(.) > 0' }],
    } as any } });
    renderProps(project, { path: 'household.hhSize', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByText(/behavior rules/i)).toBeNull();
  });

  it('shows repeat cardinality inputs for repeatable groups and dispatches updates on blur', async () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        {
          key: 'members',
          type: 'group',
          label: 'Members',
          repeatable: true,
          minItems: 1,
          maxItems: 5,
          children: [{ key: 'memberName', type: 'field', dataType: 'string' }],
        },
      ],
    } as any } });
    const spy = vi.spyOn(project, 'dispatch');
    renderProps(project, { path: 'members', type: 'group' });
    await act(async () => { screen.getByText('Select').click(); });

    const minRepeat = screen.getByLabelText(/min repeat/i);
    const maxRepeat = screen.getByLabelText(/max repeat/i);

    expect(minRepeat).toBeInTheDocument();
    expect(maxRepeat).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(minRepeat, { target: { value: '2' } });
      fireEvent.blur(minRepeat);
    });

    expect(spy).toHaveBeenCalledWith({
      type: 'definition.setItemProperty',
      payload: { path: 'members', property: 'minRepeat', value: 2 },
    });
  });

  it('shows editable choice options and dispatches updates on blur', async () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0',
      url: 'urn:test',
      version: '1.0.0',
      items: [
        {
          key: 'marital',
          type: 'field',
          dataType: 'choice',
          label: 'Marital Status',
          options: [
            { value: 'single', label: 'Single' },
            { value: 'married', label: 'Married' },
          ],
        },
      ],
    } as any } });
    const spy = vi.spyOn(project, 'dispatch');
    renderProps(project, { path: 'marital', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/options/i)).toBeInTheDocument();

    const firstValue = screen.getByLabelText(/option 1 value/i);
    const firstLabel = screen.getByLabelText(/option 1 label/i);

    await act(async () => {
      fireEvent.change(firstValue, { target: { value: 'solo' } });
      fireEvent.blur(firstValue);
    });

    expect(spy).toHaveBeenCalledWith({
      type: 'definition.setItemProperty',
      payload: {
        path: 'marital',
        property: 'options',
        value: [
          { value: 'solo', label: 'Single' },
          { value: 'married', label: 'Married' },
        ],
      },
    });
  });

  it('does not show add-rule affordances for existing behavior rules', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByRole('button', { name: /\+ add rule/i })).toBeNull();
    expect(screen.queryByLabelText(/rule expression/i)).toBeNull();
  });

  it('shows a label input for editable field labels', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Full Name')).toBeInTheDocument();
  });

  // --- Description & Hint ---

  it('shows description input with existing value', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name', description: 'Enter full name' }],
    } as any } });
    renderProps(project);
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/description/i)).toHaveValue('Enter full name');
  });

  it('shows "+ Add description" placeholder when description is empty', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/\+ add description/i)).toBeInTheDocument();
  });

  it('dispatches description change on blur', async () => {
    renderProps();
    const { project } = renderProps();
    const spy = vi.spyOn(project, 'dispatch');
    await act(async () => { screen.getAllByText('Select')[1].click(); });

    // Click "+ Add description" to reveal input
    await act(async () => { screen.getAllByText(/\+ add description/i)[0].click(); });

    const input = screen.getByLabelText(/description/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Help text' } });
      fireEvent.blur(input);
    });

    expect(spy).toHaveBeenCalledWith({
      type: 'definition.setItemProperty',
      payload: { path: 'name', property: 'description', value: 'Help text' },
    });
  });

  it('shows hint input with existing value', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name', hint: 'e.g. John Doe' }],
    } as any } });
    renderProps(project);
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/^hint$/i)).toHaveValue('e.g. John Doe');
  });

  it('shows "+ Add hint" placeholder when hint is empty', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/\+ add hint/i)).toBeInTheDocument();
  });

  it('shows both add placeholders inline when neither is set', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    const descBtn = screen.getByText(/\+ add description/i);
    const hintBtn = screen.getByText(/\+ add hint/i);
    // Walk up from descBtn to find the div.flex.gap-3 container
    const container = descBtn.closest('div[class*="flex"][class*="gap"]');
    expect(container).toBeTruthy();
    expect(container!.contains(hintBtn)).toBe(true);
  });

  it('add placeholder buttons have help tooltips', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    const descBtn = screen.getByText(/\+ add description/i);
    // The button or its wrapper should have a help tip
    fireEvent.mouseEnter(descBtn.closest('[class*="cursor-help"]')!);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  // --- widgetHint ---

  it('shows widgetHint dropdown for fields with multiple widget options', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    // string field has 3 options: TextInput, Select, RadioGroup
    expect(screen.getByLabelText(/widget/i)).toBeInTheDocument();
  });

  it('hides widgetHint dropdown when only one widget option exists', async () => {
    const singleWidgetDef = {
      ...testDef,
      items: [{ key: 'bio', type: 'field', dataType: 'text', label: 'Bio' }],
    };
    const project = createProject({ seed: { definition: singleWidgetDef as any } });
    renderProps(project, { path: 'bio', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    // text field has only TextInput — dropdown should not appear
    expect(screen.queryByLabelText(/widget/i)).not.toBeInTheDocument();
  });

  it('dispatches both component.setFieldWidget and definition hint on widget select', async () => {
    // Use a choice field so RadioGroup is a valid widget option
    const { project } = renderProps(undefined, { path: 'status', type: 'field' });
    const spy = vi.spyOn(project, 'dispatch');
    await act(async () => { screen.getByText('Select').click(); });

    const select = screen.getByLabelText(/widget/i);
    await act(async () => {
      fireEvent.change(select, { target: { value: 'RadioGroup' } });
    });

    // Tier 3: component tree
    expect(spy).toHaveBeenCalledWith({
      type: 'component.setFieldWidget',
      payload: { fieldKey: 'status', widget: 'RadioGroup' },
    });
    // Tier 1: definition fallback (for wizard/tabs mode where tree is stripped)
    expect(spy).toHaveBeenCalledWith({
      type: 'definition.setItemProperty',
      payload: { path: 'status', property: 'presentation.widgetHint', value: 'radio' },
    });
  });

  it('widget dropdown reflects current component tree node type', async () => {
    const project = createProject({ seed: { definition: testDef as any, component: testComponent as any } });
    // Change the widget via the component tree (choice field, so RadioGroup is valid)
    project.dispatch({ type: 'component.setFieldWidget', payload: { fieldKey: 'status', widget: 'RadioGroup' } });
    renderProps(project, { path: 'status', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });

    const select = screen.getByLabelText(/widget/i) as HTMLSelectElement;
    expect(select.value).toBe('RadioGroup');
  });

  it('widget dropdown maps definition widgetHint vocabulary back to component ids', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{
        key: 'status',
        type: 'field',
        dataType: 'choice',
        label: 'Status',
        options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
        presentation: { widgetHint: 'radio' },
      }],
    } as any, component: { targetDefinition: { url: 'urn:test' } } as any } });
    renderProps(project, { path: 'status', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });

    const select = screen.getByLabelText(/widget/i) as HTMLSelectElement;
    expect(select.value).toBe('RadioGroup');
  });

  it('widget dropdown value updates after selection (controlled input stays in sync)', async () => {
    // Regression: controlled <select> must reflect updated value after dispatch
    const { project } = renderProps(undefined, { path: 'status', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });

    const select = screen.getByLabelText(/widget/i) as HTMLSelectElement;
    expect(select.value).toBe('Select'); // default for choice field

    await act(async () => {
      fireEvent.change(select, { target: { value: 'RadioGroup' } });
    });

    // After dispatch + re-render, the dropdown should reflect the new value
    expect(select.value).toBe('RadioGroup');
  });

  // --- Field config: initialValue, precision, currency, prefix, suffix, semanticType ---

  it('shows initialValue input for fields', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{ key: 'count', type: 'field', dataType: 'integer', label: 'Count', initialValue: 0 }],
    } as any } });
    renderProps(project, { path: 'count', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/initial value/i)).toBeInTheDocument();
  });

  it('shows precision for decimal fields', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{ key: 'amount', type: 'field', dataType: 'decimal', label: 'Amount', precision: 2 }],
    } as any } });
    renderProps(project, { path: 'amount', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/precision/i)).toHaveValue(2);
  });

  it('does not show precision for string fields', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByLabelText(/precision/i)).not.toBeInTheDocument();
  });

  it('shows currency for money fields', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{ key: 'cost', type: 'field', dataType: 'money', label: 'Cost', currency: 'USD' }],
    } as any } });
    renderProps(project, { path: 'cost', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/currency/i)).toHaveValue('USD');
  });

  it('does not show currency for non-money fields', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByLabelText(/currency/i)).not.toBeInTheDocument();
  });

  it('shows prefix/suffix when set', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{ key: 'pct', type: 'field', dataType: 'decimal', label: 'Rate', prefix: '$', suffix: '%' }],
    } as any } });
    renderProps(project, { path: 'pct', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/prefix/i)).toHaveValue('$');
    expect(screen.getByLabelText(/suffix/i)).toHaveValue('%');
  });

  it('does not show prefix/suffix when not set', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByLabelText(/prefix/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/suffix/i)).not.toBeInTheDocument();
  });

  it('shows semanticType when set', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{ key: 'ein', type: 'field', dataType: 'string', label: 'EIN', semanticType: 'us-gov:ein' }],
    } as any } });
    renderProps(project, { path: 'ein', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/semantic type/i)).toHaveValue('us-gov:ein');
  });

  // --- prePopulate ---

  it('shows prePopulate editor when set', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{
        key: 'name', type: 'field', dataType: 'string', label: 'Name',
        prePopulate: { instance: 'priorYear', path: 'applicantName', editable: false },
      }],
    } as any } });
    renderProps(project);
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/instance/i)).toHaveValue('priorYear');
    expect(screen.getByLabelText(/^path$/i)).toHaveValue('applicantName');
    expect(screen.getByLabelText(/editable/i)).not.toBeChecked();
  });

  it('shows "+ Add pre-population" when prePopulate not set', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/\+ add pre-population/i)).toBeInTheDocument();
  });

  // --- Repeatable toggle ---

  it('shows repeatable toggle for groups', async () => {
    renderProps(undefined, { path: 'group1', type: 'group' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/repeatable/i)).toBeInTheDocument();
  });

  it('does not show repeatable toggle for fields', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByLabelText(/repeatable/i)).not.toBeInTheDocument();
  });

  it('shows min/max repeat only when repeatable is true', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{ key: 'grp', type: 'group', label: 'Group', repeatable: false, children: [] }],
    } as any } });
    renderProps(project, { path: 'grp', type: 'group' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByLabelText(/repeatable/i)).not.toBeChecked();
    expect(screen.queryByLabelText(/min repeat/i)).not.toBeInTheDocument();
  });

  // --- Options: add/remove ---

  it('does not show options section for non-choice fields', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.queryByText(/^options$/i)).not.toBeInTheDocument();
  });

  it('shows add option button for choice fields', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{
        key: 'color', type: 'field', dataType: 'choice', label: 'Color',
        options: [{ value: 'red', label: 'Red' }],
      }],
    } as any } });
    renderProps(project, { path: 'color', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByRole('button', { name: /add option/i })).toBeInTheDocument();
  });

  it('shows remove button for each option', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      items: [{
        key: 'color', type: 'field', dataType: 'choice', label: 'Color',
        options: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }],
      }],
    } as any } });
    renderProps(project, { path: 'color', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    const removeButtons = screen.getAllByRole('button', { name: /remove option/i });
    expect(removeButtons).toHaveLength(2);
  });

  // --- Definition-level properties in empty state ---

  it('shows definition properties when nothing selected', () => {
    const project = createProject({ seed: { definition: {
      $formspec: '1.0', url: 'urn:test', version: '1.0.0',
      title: 'My Form', status: 'draft',
      items: [],
    } as any } });
    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ItemProperties />
        </SelectionProvider>
      </ProjectProvider>
    );
    expect(screen.getByLabelText(/title/i)).toHaveValue('My Form');
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  // --- Help tooltips ---

  it('shows help tooltips on property rows', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    // The Type row should have a help tooltip
    const helpIcons = screen.getAllByLabelText('Help');
    expect(helpIcons.length).toBeGreaterThan(0);
  });

  // --- Link-out for binds ---

  it('shows "go to logic" link on bind cards', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    // The name field has a required bind
    expect(screen.getByLabelText(/edit in logic/i)).toBeInTheDocument();
  });

  it('shows "+ Add behavior rule" when no binds exist', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      binds: [],
      items: [{ key: 'solo', type: 'field', dataType: 'string', label: 'Solo' }],
    } as any } });
    renderProps(project, { path: 'solo', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    expect(screen.getByText(/\+ add behavior rule/i)).toBeInTheDocument();
  });

  // --- Action buttons (no tooltips, just plain buttons) ---

  it('action buttons do not have help tooltips', async () => {
    renderProps();
    await act(async () => { screen.getByText('Select').click(); });
    const dupBtn = screen.getByRole('button', { name: /duplicate/i });
    // No cursor-help wrapper on action buttons
    expect(dupBtn.closest('[class*="cursor-help"]')).toBeNull();
  });

  // --- Add behavior rule tooltip ---

  it('"+ Add behavior rule" has help tooltip', async () => {
    const project = createProject({ seed: { definition: {
      ...testDef,
      binds: [],
      items: [{ key: 'solo', type: 'field', dataType: 'string', label: 'Solo' }],
    } as any } });
    renderProps(project, { path: 'solo', type: 'field' });
    await act(async () => { screen.getByText('Select').click(); });
    const addRule = screen.getByText(/\+ add behavior rule/i);
    const wrapper = addRule.closest('[class*="cursor-help"]');
    expect(wrapper).toBeTruthy();
  });

  describe('multi-select summary', () => {
    function MultiSelectInspect({ paths }: { paths: { key: string; type: string }[] }) {
      const { select, toggleSelect } = useSelection();
      return (
        <>
          <button data-testid="setup-multiselect" onClick={() => {
            // First plain select, then toggle the rest
            select(paths[0].key, paths[0].type);
            for (let i = 1; i < paths.length; i++) {
              toggleSelect(paths[i].key, paths[i].type);
            }
          }}>
            Multi-Select
          </button>
          <ItemProperties />
        </>
      );
    }

    function renderMultiSelectProps(paths: { key: string; type: string }[]) {
      const def = {
        $formspec: '1.0', url: 'urn:multi-select', version: '1.0.0',
        items: [
          { key: 'fieldA', type: 'field', dataType: 'string', label: 'Field A' },
          { key: 'fieldB', type: 'field', dataType: 'string', label: 'Field B' },
          { key: 'fieldC', type: 'field', dataType: 'string', label: 'Field C' },
        ],
      };
      const project = createProject({ seed: { definition: def as any } });
      return {
        ...render(
          <ProjectProvider project={project}>
            <SelectionProvider>
              <MultiSelectInspect paths={paths} />
            </SelectionProvider>
          </ProjectProvider>,
        ),
        project,
      };
    }

    it('shows summary view with item count when multiple items selected', async () => {
      renderMultiSelectProps([
        { key: 'fieldA', type: 'field' },
        { key: 'fieldB', type: 'field' },
      ]);
      await act(async () => {
        screen.getByTestId('setup-multiselect').click();
      });
      expect(screen.getByText('2 items selected')).toBeInTheDocument();
    });

    it('shows batch action buttons in summary view', async () => {
      renderMultiSelectProps([
        { key: 'fieldA', type: 'field' },
        { key: 'fieldB', type: 'field' },
        { key: 'fieldC', type: 'field' },
      ]);
      await act(async () => {
        screen.getByTestId('setup-multiselect').click();
      });
      expect(screen.getByText('3 items selected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /duplicate all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete all/i })).toBeInTheDocument();
    });

    it('batch delete from summary removes all selected items', async () => {
      const { project } = renderMultiSelectProps([
        { key: 'fieldA', type: 'field' },
        { key: 'fieldB', type: 'field' },
      ]);
      await act(async () => {
        screen.getByTestId('setup-multiselect').click();
      });
      await act(async () => {
        screen.getByRole('button', { name: /delete all/i }).click();
      });
      const keys = project.definition.items.map((i: any) => i.key);
      expect(keys).not.toContain('fieldA');
      expect(keys).not.toContain('fieldB');
      expect(keys).toContain('fieldC');
    });
  });
});
