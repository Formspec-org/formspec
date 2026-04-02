/** @filedesc Tests for the DefinitionTreeEditor — pure definition-tier tree view. */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../../src/state/useSelection';
import { DefinitionTreeEditor } from '../../../src/workspaces/editor/DefinitionTreeEditor';

function renderTree(definition: any) {
  const project = createProject({ seed: { definition } });
  return {
    project,
    ...render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <DefinitionTreeEditor />
        </SelectionProvider>
      </ProjectProvider>,
    ),
  };
}

describe('DefinitionTreeEditor', () => {
  it('renders field items with label and dataType badge', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
    });
    expect(screen.getByTestId('field-name')).toBeInTheDocument();
    expect(screen.getByTestId('field-age')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('string')).toBeInTheDocument();
  });

  it('uses an explicit drag handle instead of making the whole row draggable', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-drag-handle', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    });

    const row = screen.getByTestId('field-name');
    expect(row.parentElement).not.toHaveAttribute('role', 'button');
    expect(within(row).getByRole('button', { name: 'Reorder Full Name' })).toBeInTheDocument();
  });

  it('shows description and hint text in the field row when present', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-row-meta', version: '1.0.0',
      items: [
        {
          key: 'email',
          type: 'field',
          dataType: 'string',
          label: 'Email',
          description: 'Used for account updates.',
          hint: 'We never share your address.',
        },
      ],
    });

    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Hint')).toBeInTheDocument();
    expect(screen.getByText('Used for account updates.')).toBeInTheDocument();
    expect(screen.getByText('We never share your address.')).toBeInTheDocument();
  });

  it('shows empty description and hint slots and adds rules from summary categories', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-row-add-missing', version: '1.0.0',
      items: [
        {
          key: 'email',
          type: 'field',
          dataType: 'string',
          label: 'Email',
        },
      ],
    });

    const row = within(screen.getByTestId('field-email'));
    fireEvent.click(row.getByRole('button', { name: 'Select Email' }));

    expect(row.getByText('Description')).toBeInTheDocument();
    expect(row.getByText('Hint')).toBeInTheDocument();
    expect(row.getByText('Click to add description')).toBeInTheDocument();
    expect(row.getByText('Click to add hint')).toBeInTheDocument();
    expect(row.getByTestId('field-email-category-Visibility')).toBeInTheDocument();
    fireEvent.click(row.getByTestId('field-email-category-Visibility'));
    expect(row.getByRole('region', { name: 'Field details' })).toBeInTheDocument();
    expect(row.getByRole('button', { name: /Add visibility condition/i })).toBeInTheDocument();
  });

  it('hides empty description and hint rows when unselected', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-row-collapse-empty', version: '1.0.0',
      items: [
        {
          key: 'email',
          type: 'field',
          dataType: 'string',
          label: 'Email',
        },
      ],
    });

    const row = within(screen.getByTestId('field-email'));

    // Unselected: empty Description/Hint should NOT appear
    expect(row.queryByText('Description')).toBeNull();
    expect(row.queryByText('Hint')).toBeNull();

    // Select the row
    fireEvent.click(row.getByRole('button', { name: 'Select Email' }));

    // Selected: empty Description/Hint slots should appear with placeholders
    expect(row.getByText('Description')).toBeInTheDocument();
    expect(row.getByText('Hint')).toBeInTheDocument();
    expect(row.getByText('Click to add description')).toBeInTheDocument();
    expect(row.getByText('Click to add hint')).toBeInTheDocument();
  });

  it('shows populated description and hides empty hint row when unselected (partial metadata)', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-row-partial-metadata', version: '1.0.0',
      items: [
        {
          key: 'name',
          type: 'field',
          dataType: 'string',
          label: 'Name',
          description: 'Your full legal name.',
        },
      ],
    });

    const row = within(screen.getByTestId('field-name'));

    // Unselected: only populated Description shows; empty Hint must not appear
    expect(row.getByText('Description')).toBeInTheDocument();
    expect(row.getByText('Your full legal name.')).toBeInTheDocument();
    expect(row.queryByText('Hint')).toBeNull();

    // Select the row: now Hint slot appears too with a placeholder
    fireEvent.click(row.getByRole('button', { name: 'Select Name' }));
    expect(row.getByText('Hint')).toBeInTheDocument();
    expect(row.getByText('Click to add hint')).toBeInTheDocument();
  });

  it('shows populated description and hint slots when the field already has validation binds', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-row-add-hidden', version: '1.0.0',
      items: [
        {
          key: 'email',
          type: 'field',
          dataType: 'string',
          label: 'Email',
          description: 'Used for account updates.',
          hint: 'We never share your address.',
        },
      ],
      binds: [
        { path: 'email', required: 'true' },
      ],
    });

    const row = within(screen.getByTestId('field-email'));
    expect(row.getByText('Used for account updates.')).toBeInTheDocument();
    expect(row.getByText('We never share your address.')).toBeInTheDocument();
    expect(row.getByText('1 rule')).toBeInTheDocument();
  });

  it('surfaces field config and behavior details in the row summary', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-field-summary', version: '1.0.0',
      items: [
        {
          key: 'amount',
          type: 'field',
          dataType: 'money',
          label: 'Amount',
          initialValue: '25',
          precision: 2,
          currency: 'USD',
          prefix: '$',
          suffix: 'monthly',
          semanticType: 'finance:amount',
        },
        {
          key: 'status',
          type: 'field',
          dataType: 'choice',
          label: 'Status',
          options: [
            { value: 'new', label: 'New' },
            { value: 'open', label: 'Open' },
          ],
          prePopulate: { instance: 'profile', path: 'status' },
        },
      ],
      binds: [
        { path: 'amount', relevant: '$enabled = true', required: 'true', readonly: '$locked = true', constraint: '. > 0', constraintMessage: 'Must be positive' },
        { path: 'status', calculate: '$source.status' },
      ],
    });

    const amountRow = within(screen.getByTestId('field-amount'));
    const statusRow = within(screen.getByTestId('field-status'));
    expect(amountRow.getByTestId('field-amount-summary')).toBeInTheDocument();
    expect(amountRow.getByTestId('field-amount-status')).toBeInTheDocument();
    expect(statusRow.getByTestId('field-status-summary')).toBeInTheDocument();
    expect(statusRow.getByTestId('field-status-status')).toBeInTheDocument();

    // Category grid shows fixed slots with summarised values
    const amountSummary = within(amountRow.getByTestId('field-amount-summary'));
    expect(amountSummary.getByText('Visibility')).toBeInTheDocument();
    expect(amountSummary.getByText(/Enabled is Yes/)).toBeInTheDocument();
    expect(amountSummary.getByText('Validation')).toBeInTheDocument();
    expect(amountSummary.getByText('2 rules')).toBeInTheDocument();
    expect(amountSummary.getByText('Value')).toBeInTheDocument();
    expect(amountSummary.getByText(/25 · locked/)).toBeInTheDocument();
    expect(amountSummary.getByText('Format')).toBeInTheDocument();
    expect(amountSummary.getByText('USD 2dp')).toBeInTheDocument();

    // Pills omit duplicate Value cues (locked); other bind cues stay as pills
    expect(amountRow.getByText('must fill')).toBeInTheDocument();
    expect(amountRow.getByText('shows if')).toBeInTheDocument();
    expect(amountRow.getByText('validates')).toBeInTheDocument();
    expect(amountRow.queryByTitle('readonly')).not.toBeInTheDocument();

    const statusSummary = within(statusRow.getByTestId('field-status-summary'));
    expect(statusSummary.getByText('Visibility')).toBeInTheDocument();
    expect(statusSummary.getByText('Value')).toBeInTheDocument();
    expect(statusSummary.getByText('formula')).toBeInTheDocument();
    expect(statusRow.queryByTitle('calculate')).not.toBeInTheDocument();
    expect(statusRow.getByText('linked')).toBeInTheDocument();
  });

  it('always shows exactly four fixed category slots for fields regardless of data richness', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-summary-cap', version: '1.0.0',
      items: [
        {
          key: 'amount',
          type: 'field',
          dataType: 'money',
          label: 'Amount',
          description: 'Monthly amount for review.',
          hint: 'Use gross income before deductions.',
          initialValue: '25',
          precision: 2,
          currency: 'USD',
          prefix: '$',
          semanticType: 'finance:amount',
          prePopulate: { instance: 'profile', path: 'income.amount' },
        },
      ],
      binds: [
        { path: 'amount', relevant: '$enabled = true', constraint: '. > 0' },
      ],
    });

    const summary = within(screen.getByTestId('field-amount-summary'));
    const terms = summary.getAllByRole('term');
    expect(terms).toHaveLength(4);
    expect(terms[0]).toHaveTextContent('Visibility');
    expect(terms[1]).toHaveTextContent('Validation');
    expect(terms[2]).toHaveTextContent('Value');
    expect(terms[3]).toHaveTextContent('Format');

    // Old variable-length labels no longer appear in the category grid
    expect(summary.queryByText('Pre-fill')).toBeNull();
    expect(summary.queryByText('Relevant')).toBeNull();
    expect(summary.queryByText('Precision')).toBeNull();
    expect(summary.queryByText('Prefix')).toBeNull();
    expect(summary.queryByText('Constraint')).toBeNull();

    // Description/Hint are in a separate content section, not the category grid
    const row = within(screen.getByTestId('field-amount'));
    expect(row.getByText('Description')).toBeInTheDocument();
    expect(row.getByText('Monthly amount for review.')).toBeInTheDocument();
    expect(row.getByText('Hint')).toBeInTheDocument();
    expect(row.getByText('Use gross income before deductions.')).toBeInTheDocument();
  });

  it('renders group items as collapsible nodes with children', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'contact', type: 'group', label: 'Contact',
        children: [
          { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
        ],
      }],
    });
    expect(screen.getByTestId('group-contact')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('contact')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows group description and hint text in the group row when present', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-group-meta', version: '1.0.0',
      items: [{
        key: 'contact',
        type: 'group',
        label: 'Contact',
        description: 'Organize the applicant contact block.',
        hint: 'Collect the primary point of contact.',
        children: [],
      }],
    });

    const contactGroup = within(screen.getByTestId('group-contact'));
    expect(contactGroup.getByTestId('group-contact-summary')).toBeInTheDocument();
    expect(contactGroup.getByText('Description')).toBeInTheDocument();
    expect(contactGroup.getByText('Organize the applicant contact block.')).toBeInTheDocument();
    expect(contactGroup.getByText('Hint')).toBeInTheDocument();
    expect(contactGroup.getByText('Collect the primary point of contact.')).toBeInTheDocument();
  });

  it('shows missing optional group actions when the group is selected', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-group-add-missing', version: '1.0.0',
      items: [{
        key: 'contact',
        type: 'group',
        label: 'Contact',
        children: [],
      }],
    });

    const group = within(screen.getByTestId('group-contact'));
    expect(group.queryByRole('button', { name: 'Add description to Contact' })).toBeNull();
    expect(group.queryByRole('button', { name: 'Add hint to Contact' })).toBeNull();
    expect(group.queryByRole('button', { name: 'Add behavior to Contact' })).toBeNull();

    fireEvent.click(group.getByRole('button', { name: 'Select group Contact' }));

    expect(group.getByRole('button', { name: 'Add description to Contact' })).toBeInTheDocument();
    expect(group.getByRole('button', { name: 'Add hint to Contact' })).toBeInTheDocument();
    expect(group.getByRole('button', { name: 'Add behavior to Contact' })).toBeInTheDocument();
  });

  it('omits display items from the structure tree (content lives in layout workspace)', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [
        { key: 'intro', type: 'display', label: 'Welcome', presentation: { widgetHint: 'heading' } },
      ],
    });
    expect(screen.queryByTestId('display-intro')).toBeNull();
  });

  it('shows the full item tree regardless of pageMode', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      formPresentation: { pageMode: 'wizard' },
      items: [
        { key: 'page1', type: 'group', label: 'Page 1', children: [
          { key: 'f1', type: 'field', dataType: 'string', label: 'Field 1' },
        ]},
        { key: 'page2', type: 'group', label: 'Page 2', children: [
          { key: 'f2', type: 'field', dataType: 'string', label: 'Field 2' },
        ]},
      ],
    });
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(screen.getByText('Field 1')).toBeInTheDocument();
    expect(screen.getByText('Field 2')).toBeInTheDocument();
  });

  it('shows bind indicator pills', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name' }],
      binds: [{ path: 'name', required: 'true' }],
    });
    expect(screen.getByText('must fill')).toBeInTheDocument();
  });

  it('has an Add Item button', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [],
    });
    expect(screen.getByTestId('add-item')).toBeInTheDocument();
  });

  it('shows an empty-state editor canvas when no items exist', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [],
    });

    expect(screen.getByTestId('editor-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/start building your form/i)).toBeInTheDocument();
  });

  it('surfaces the active selection in the editor header while keeping editing inline', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-active-header', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    });

    expect(screen.getByRole('heading', { name: 'Form structure' })).toBeInTheDocument();
    expect(screen.getByText('Select a group or field to edit it inline, or add new structure below.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select Full Name' }));

    expect(screen.getByRole('heading', { name: 'Full Name' })).toBeInTheDocument();
    expect(screen.getByText('Field key name in Root. Edit details inline below.')).toBeInTheDocument();
    expect(screen.getByText('Active selection')).toBeInTheDocument();
  });

  it('renders nested groups with deeply nested fields', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'outer', type: 'group', label: 'Outer',
        children: [{
          key: 'inner', type: 'group', label: 'Inner',
          children: [
            { key: 'deep', type: 'field', dataType: 'string', label: 'Deep Field' },
          ],
        }],
      }],
    });
    expect(screen.getByTestId('group-outer')).toBeInTheDocument();
    expect(screen.getByTestId('group-inner')).toBeInTheDocument();
    expect(screen.getByTestId('field-deep')).toBeInTheDocument();
  });

  it('offsets nested group contents inside a visible child rail', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-nested-offset', version: '1.0.0',
      items: [{
        key: 'outer', type: 'group', label: 'Outer',
        children: [{
          key: 'inner', type: 'group', label: 'Inner',
          children: [
            { key: 'deep', type: 'field', dataType: 'string', label: 'Deep Field' },
          ],
        }],
      }],
    });

    const outerChildren = screen.getByTestId('group-outer-children');
    expect(outerChildren.className).toContain('mt-2');
    expect(outerChildren.className).toContain('flex');
    expect(outerChildren.className).toMatch(/px-4|md:px-6/);
  });

  it('falls back to itemKey when label is missing', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [
        { key: 'unlabeled', type: 'field', dataType: 'string' },
      ],
    });
    expect(screen.getByTestId('field-unlabeled')).toBeInTheDocument();
  });

  it('shows formula and locked in Value summary without duplicate pills', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [
        { key: 'total', type: 'field', dataType: 'decimal', label: 'Total' },
        { key: 'locked', type: 'field', dataType: 'string', label: 'Locked' },
      ],
      binds: [
        { path: 'total', calculate: '$a + $b' },
        { path: 'locked', readonly: 'true' },
      ],
    });
    const totalSummary = within(screen.getByTestId('field-total-summary'));
    expect(totalSummary.getByText('formula')).toBeInTheDocument();
    expect(screen.queryByTestId('field-total-status')).not.toBeInTheDocument();

    const lockedSummary = within(screen.getByTestId('field-locked-summary'));
    expect(lockedSummary.getByText('locked')).toBeInTheDocument();
    expect(screen.queryByTestId('field-locked-status')).not.toBeInTheDocument();
  });

  it('shows repeatable badge on groups', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'items', type: 'group', label: 'Line Items',
        repeatable: true, minRepeat: 1, maxRepeat: 5,
        children: [
          { key: 'desc', type: 'field', dataType: 'string', label: 'Description' },
        ],
      }],
    });
    expect(screen.getByTestId('group-items')).toBeInTheDocument();
    // The repeat pill badge shows the recycle icon and range
    expect(screen.getByText(/⟳\s*1–5/)).toBeInTheDocument();
  });

  it('handles object-style binds after normalization', () => {
    // createProject normalizes object binds to array format
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{ key: 'f', type: 'field', dataType: 'string', label: 'F' }],
      binds: { f: { required: 'true' } },
    });
    expect(screen.getByText('must fill')).toBeInTheDocument();
  });

  it('renders empty tree without errors', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [],
    });
    // Only the add-item button should be present
    expect(screen.getByTestId('add-item')).toBeInTheDocument();
    expect(screen.queryByTestId(/^field-/)).toBeNull();
    expect(screen.queryByTestId(/^group-/)).toBeNull();
  });

  it('shows binds for nested fields using dotted paths', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'g', type: 'group', label: 'G',
        children: [
          { key: 'nested', type: 'field', dataType: 'string', label: 'Nested' },
        ],
      }],
      binds: [{ path: 'g.nested', required: 'true' }],
    });
    expect(screen.getByText('must fill')).toBeInTheDocument();
  });

  it('collapses group children when toggle is clicked', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'section', type: 'group', label: 'Section',
        children: [
          { key: 'child', type: 'field', dataType: 'string', label: 'Child Field' },
        ],
      }],
    });
    // Child visible by default
    expect(screen.getByText('Child Field')).toBeInTheDocument();

    // Click the expand/collapse toggle to collapse
    fireEvent.click(screen.getByTestId('toggle-section'));
    expect(screen.queryByText('Child Field')).toBeNull();

    // Click again to expand
    fireEvent.click(screen.getByTestId('toggle-section'));
    expect(screen.getByText('Child Field')).toBeInTheDocument();
  });

  it('renders group toggles as visible button controls', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'section', type: 'group', label: 'Section',
        children: [
          { key: 'child', type: 'field', dataType: 'string', label: 'Child Field' },
        ],
      }],
    });

    expect(screen.getByTestId('toggle-section')).toHaveClass('border-border/80');
    expect(screen.getByTestId('toggle-section')).toHaveClass('bg-surface');
  });

  it('updates aria-expanded on group toggles as groups open and close', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-group-expanded', version: '1.0.0',
      items: [{
        key: 'section', type: 'group', label: 'Section',
        children: [
          { key: 'child', type: 'field', dataType: 'string', label: 'Child Field' },
        ],
      }],
    });

    const toggle = screen.getByRole('button', { name: 'Collapse Section' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Expand Section' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders an add button on each group row', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-test', version: '1.0.0',
      items: [{
        key: 'section', type: 'group', label: 'Section',
        children: [],
      }],
    });

    expect(screen.getByTestId('add-to-section')).toBeInTheDocument();
    expect(screen.getByLabelText('Add item to Section')).toBeInTheDocument();
  });

  it('adds a new item inside the targeted group from the inline add button', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-add', version: '1.0.0',
      items: [{
        key: 'section', type: 'group', label: 'Section',
        children: [],
      }],
    };
    const { project } = renderTree(definition);

    fireEvent.click(screen.getByTestId('add-to-section'));
    expect(screen.getByText('Add Item to Section')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Text Short text\b/i }));

    const section = project.definition.items[0] as any;
    expect(section.children).toHaveLength(1);
    expect(section.children[0].type).toBe('field');
    expect(screen.getByTestId(`field-${section.children[0].key}`)).toBeInTheDocument();
    expect(screen.getByTestId(`field-${section.children[0].key}`).className).toContain('border-accent/50');
  });

  it('edits the label inline without opening the key editor and saves on blur', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-identity', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    };
    const { project } = renderTree(definition);

    fireEvent.click(within(screen.getByTestId('field-name')).getByRole('button', { name: 'Select Full Name' }));
    fireEvent.click(within(screen.getByTestId('field-name')).getByText('Full Name'));

    const labelInput = within(screen.getByTestId('field-name')).getByLabelText('Inline label');
    expect(within(screen.getByTestId('field-name')).queryByLabelText('Inline key')).toBeNull();
    fireEvent.change(labelInput, { target: { value: 'Legal Name' } });
    fireEvent.blur(labelInput);

    expect((project.definition.items[0] as any)?.label).toBe('Legal Name');
    expect(project.definition.items[0]?.key).toBe('name');
    expect(within(screen.getByTestId('field-name')).queryByLabelText('Inline label')).toBeNull();
  });

  it('edits the key inline without opening the label editor and saves on blur', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-key', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
      ],
    };
    const { project } = renderTree(definition);

    fireEvent.click(within(screen.getByTestId('field-name')).getByRole('button', { name: 'Select Full Name' }));
    fireEvent.click(within(screen.getByTestId('field-name')).getByText('name'));

    const keyInput = within(screen.getByTestId('field-name')).getByLabelText('Inline key');
    expect(within(screen.getByTestId('field-name')).queryByLabelText('Inline label')).toBeNull();
    fireEvent.change(keyInput, { target: { value: 'legalName' } });
    fireEvent.blur(keyInput);

    expect(project.definition.items[0]?.key).toBe('legalName');
    expect((project.definition.items[0] as any)?.label).toBe('Full Name');
    expect(screen.getByTestId('field-legalName')).toBeInTheDocument();
  });

  it('replaces the old selected-row pill strip with calmer inline entry points', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-calm-actions', version: '1.0.0',
      items: [
        {
          key: 'name',
          type: 'field',
          dataType: 'string',
          label: 'Full Name',
          description: 'Primary legal name.',
          hint: 'Enter first and last name.',
        },
      ],
    });

    const row = within(screen.getByTestId('field-name'));
    fireEvent.click(row.getByRole('button', { name: 'Select Full Name' }));

    expect(row.queryByRole('button', { name: 'Edit content for Full Name' })).toBeNull();
    expect(row.queryByRole('button', { name: 'Edit field config for Full Name' })).toBeNull();
    expect(row.queryByRole('button', { name: 'Edit behavior for Full Name' })).toBeNull();
    expect(row.queryByRole('button', { name: 'Edit identity for Full Name' })).toBeNull();
    expect(row.queryByRole('button', { name: 'Edit Description for Full Name' })).toBeNull();
    expect(row.queryByRole('button', { name: 'Edit Hint for Full Name' })).toBeNull();

    fireEvent.click(row.getByText('Primary legal name.'));
    expect(row.getByLabelText('Inline description')).toBeInTheDocument();
  });

  it('supports inline repeat settings on selected group headers', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-repeat', version: '1.0.0',
      items: [{
        key: 'members', type: 'group', label: 'Members',
        children: [],
      }],
    };
    const { project } = renderTree(definition);

    fireEvent.click(within(screen.getByTestId('group-members')).getByRole('button', { name: 'Select group Members' }));
    fireEvent.click(within(screen.getByTestId('group-members')).getByRole('button', { name: 'Edit repeats for Members' }));

    fireEvent.click(within(screen.getByTestId('group-members')).getByLabelText('Repeatable'));
    fireEvent.change(within(screen.getByTestId('group-members')).getByLabelText('Minimum repeats'), { target: { value: '1' } });
    fireEvent.change(within(screen.getByTestId('group-members')).getByLabelText('Maximum repeats'), { target: { value: '4' } });

    expect((project.definition.items[0] as any)?.repeatable).toBe(true);
    expect((project.definition.items[0] as any)?.minRepeat).toBe(1);
    expect((project.definition.items[0] as any)?.maxRepeat).toBe(4);
    expect(within(screen.getByTestId('group-members')).getByText(/1.*4/)).toBeInTheDocument();
  });

  it('edits the group label inline without opening the key editor and saves on blur', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-group-label', version: '1.0.0',
      items: [
        { key: 'household', type: 'group', label: 'Household', children: [] },
      ],
    };
    const { project } = renderTree(definition);

    fireEvent.click(within(screen.getByTestId('group-household')).getByRole('button', { name: 'Select group Household' }));
    fireEvent.click(within(screen.getByTestId('group-household')).getByText('Household'));

    const labelInput = within(screen.getByTestId('group-household')).getByLabelText('Inline label');
    expect(within(screen.getByTestId('group-household')).queryByLabelText('Inline key')).toBeNull();
    fireEvent.change(labelInput, { target: { value: 'Primary Household' } });
    fireEvent.blur(labelInput);

    expect((project.definition.items[0] as any)?.label).toBe('Primary Household');
    expect(project.definition.items[0]?.key).toBe('household');
  });

  it('edits the group key inline without opening the label editor and saves on blur', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-group-key', version: '1.0.0',
      items: [
        { key: 'household', type: 'group', label: 'Household', children: [] },
      ],
    };
    const { project } = renderTree(definition);

    fireEvent.click(within(screen.getByTestId('group-household')).getByRole('button', { name: 'Select group Household' }));
    fireEvent.click(within(screen.getByTestId('group-household')).getByText('household'));

    const keyInput = within(screen.getByTestId('group-household')).getByLabelText('Inline key');
    expect(within(screen.getByTestId('group-household')).queryByLabelText('Inline label')).toBeNull();
    fireEvent.change(keyInput, { target: { value: 'primaryHousehold' } });
    fireEvent.blur(keyInput);

    expect(project.definition.items[0]?.key).toBe('primaryHousehold');
    expect((project.definition.items[0] as any)?.label).toBe('Household');
  });

  it('supports inline content editing for a selected field row', () => {
    vi.useFakeTimers();
    try {
      const definition = {
        $formspec: '1.0', url: 'urn:tree-inline-content', version: '1.0.0',
        items: [
          { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
        ],
      };
      const { project } = renderTree(definition);

      fireEvent.click(within(screen.getByTestId('field-name')).getByRole('button', { name: 'Select Full Name' }));
      fireEvent.click(within(screen.getByTestId('field-name')).getByText('Click to add description'));

      fireEvent.change(within(screen.getByTestId('field-name')).getByLabelText('Inline description'), { target: { value: 'Used for household identity.' } });
      // SI-5: Description/Hint writes are debounced — flush the timer before asserting.
      vi.advanceTimersByTime(300);
      fireEvent.blur(within(screen.getByTestId('field-name')).getByLabelText('Inline description'));
      fireEvent.click(within(screen.getByTestId('field-name')).getByText('Click to add hint'));
      fireEvent.change(within(screen.getByTestId('field-name')).getByLabelText('Inline hint'), { target: { value: 'First middle last' } });
      vi.advanceTimersByTime(300);
      fireEvent.blur(within(screen.getByTestId('field-name')).getByLabelText('Inline hint'));

      expect((project.definition.items[0] as any)?.description).toBe('Used for household identity.');
      expect((project.definition.items[0] as any)?.hint).toBe('First middle last');
      expect(within(screen.getByTestId('field-name')).getByText('Description')).toBeInTheDocument();
      expect(within(screen.getByTestId('field-name')).getByText('Used for household identity.')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps only one inline editor open at a time within a row', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-inline-single-editor', version: '1.0.0',
      items: [
        {
          key: 'name',
          type: 'field',
          dataType: 'string',
          label: 'Full Name',
          description: 'Primary legal name.',
          hint: 'Enter first and last name.',
        },
      ],
    });

    const row = within(screen.getByTestId('field-name'));
    fireEvent.click(row.getByRole('button', { name: 'Select Full Name' }));
    fireEvent.click(row.getByText('Primary legal name.'));
    expect(row.getByLabelText('Inline description')).toBeInTheDocument();

    fireEvent.click(row.getByText('Enter first and last name.'));
    expect(row.queryByLabelText('Inline description')).toBeNull();
    expect(row.getByLabelText('Inline hint')).toBeInTheDocument();
  });

  it('closes the expanded category editor when editing description or hint inline (SM-1)', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-lower-panel-desc-hint', version: '1.0.0',
      items: [
        {
          key: 'name',
          type: 'field',
          dataType: 'string',
          label: 'Full Name',
          description: 'Primary legal name.',
          hint: 'Enter first and last name.',
        },
      ],
    });

    const row = within(screen.getByTestId('field-name'));
    fireEvent.click(row.getByRole('button', { name: 'Select Full Name' }));
    fireEvent.click(row.getByTestId('field-name-category-Visibility'));
    expect(row.getByTestId('field-name-lower-editor')).toBeInTheDocument();

    // SM-1: Opening inline description closes the category panel.
    fireEvent.click(row.getByText('Primary legal name.'));
    expect(row.getByLabelText('Inline description')).toBeInTheDocument();
    expect(row.queryByTestId('field-name-lower-editor')).toBeNull();

    fireEvent.blur(row.getByLabelText('Inline description'));

    // SM-1: Opening inline hint also keeps the category panel closed.
    fireEvent.click(row.getByText('Enter first and last name.'));
    expect(row.getByLabelText('Inline hint')).toBeInTheDocument();
    expect(row.queryByTestId('field-name-lower-editor')).toBeNull();
  });

  it('supports inline field config editing for selected field rows', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-config', version: '1.0.0',
      items: [
        { key: 'amount', type: 'field', dataType: 'money', label: 'Amount' },
      ],
    };
    const { project } = renderTree(definition);

    const row = within(screen.getByTestId('field-amount'));
    fireEvent.click(row.getByRole('button', { name: 'Select Amount' }));
    fireEvent.click(row.getByTestId('field-amount-category-Format'));
    // Currency, precision, prefix use field-detail launchers
    fireEvent.click(row.getByTestId('field-amount-add-currency'));
    fireEvent.change(row.getByLabelText('Inline currency'), { target: { value: 'USD' } });
    fireEvent.blur(row.getByLabelText('Inline currency'));
    fireEvent.click(row.getByTestId('field-amount-add-precision'));
    fireEvent.change(row.getByLabelText('Inline precision'), { target: { value: '2' } });
    fireEvent.blur(row.getByLabelText('Inline precision'));
    fireEvent.click(row.getByTestId('field-amount-add-prefix'));
    fireEvent.change(row.getByLabelText('Inline prefix'), { target: { value: '$' } });
    fireEvent.blur(row.getByLabelText('Inline prefix'));

    expect((project.definition.items[0] as any)?.currency).toBe('USD');
    expect((project.definition.items[0] as any)?.precision).toBe(2);
    expect((project.definition.items[0] as any)?.prefix).toBe('$');
  });

  it('uses stronger lower-editor label contrast in the selected field editor', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-editor-label-contrast', version: '1.0.0',
      items: [
        { key: 'amount', type: 'field', dataType: 'money', label: 'Amount' },
      ],
    });

    const row = within(screen.getByTestId('field-amount'));
    fireEvent.click(row.getByRole('button', { name: 'Select Amount' }));
    fireEvent.click(row.getByTestId('field-amount-category-Visibility'));
    const lowerEditor = row.getByTestId('field-amount-lower-editor');

    const heading = lowerEditor.querySelector('h3');
    expect(heading).toBeTruthy();
    expect(heading).toHaveClass('text-[13px]');
    expect(heading).toHaveClass('font-semibold');
    expect(lowerEditor).toHaveClass('space-y-3');
    fireEvent.click(row.getByTestId('field-amount-category-Format'));
    expect(row.getByTestId('field-amount-add-semantic')).toHaveClass('text-accent');
    expect(row.getByTestId('field-amount-add-prefix')).toHaveClass('text-accent');
    fireEvent.click(row.getByTestId('field-amount-add-semantic'));
    expect(row.getByLabelText('Inline semantic')).toBeInTheDocument();
    fireEvent.blur(row.getByLabelText('Inline semantic'));
    fireEvent.click(row.getByTestId('field-amount-add-prefix'));
    expect(row.getByLabelText('Inline prefix')).toBeInTheDocument();
  });

  it('shows bind consistency advisories in the expanded category panel', () => {
    const { project } = renderTree({
      $formspec: '1.0', url: 'urn:tree-advisories', version: '1.0.0',
      items: [
        { key: 'total', type: 'field', dataType: 'decimal', label: 'Total' },
      ],
      binds: [
        {
          path: 'total',
          required: 'true',
          readonly: 'true',
          calculate: '$a + $b',
        },
      ],
    });

    const row = within(screen.getByTestId('field-total'));
    fireEvent.click(row.getByRole('button', { name: 'Select Total' }));
    fireEvent.click(row.getByTestId('field-total-category-Validation'));
    const advisoriesRegion = row.getByTestId('field-total-advisories');
    expect(advisoriesRegion).toBeInTheDocument();
    expect(within(advisoriesRegion).getByRole('status')).toHaveTextContent(
      /mandatory rule is usually redundant/,
    );
    expect(
      within(advisoriesRegion).getByRole('button', { name: 'Review formula' }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(advisoriesRegion).getByRole('button', { name: 'Remove mandatory rule' }),
    );
    const totalBind = (project.definition.binds as { path: string; required?: string }[]).find(
      (b) => b.path === 'total',
    );
    expect(totalBind?.required).toBeFalsy();
  });

  it('edits visible content rows (Hint) with single-line inline inputs', () => {
    vi.useFakeTimers();
    try {
      const definition = {
        $formspec: '1.0', url: 'urn:tree-inline-summary-inputs', version: '1.0.0',
        items: [
          {
            key: 'ssn',
            type: 'field',
            dataType: 'string',
            label: 'SSN',
            hint: 'XXX-XX-XXXX',
            semanticType: 'us-gov:ssn',
          },
        ],
      };
      const { project } = renderTree(definition);

      const row = within(screen.getByTestId('field-ssn'));
      fireEvent.click(row.getByRole('button', { name: 'Select SSN' }));

      // KN-5: Key text no longer carries role="heading" when inside a <button>.
      expect(row.getByTestId('field-ssn-key-edit')).toBeInTheDocument();
      expect(row.getByTestId('field-ssn-label-edit')).toBeInTheDocument();
      expect(row.getByTestId('field-ssn-key-edit')).toBeInTheDocument();
      expect(row.getByTestId('field-ssn-summary-edit-Hint')).toBeInTheDocument();

      // Hint is in the content rows and editable inline
      fireEvent.click(row.getByText('XXX-XX-XXXX'));
      const hintInput = row.getByLabelText('Inline hint');
      expect(hintInput.tagName).toBe('INPUT');
      expect(hintInput).toHaveFocus();
      fireEvent.change(hintInput, { target: { value: '999-99-9999' } });
      // SI-5: Hint writes are debounced — flush the timer before asserting.
      vi.advanceTimersByTime(300);
      fireEvent.blur(hintInput);

      expect((project.definition.items[0] as any)?.hint).toBe('999-99-9999');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the field type token on the primary row with the field key', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-title-type-band', version: '1.0.0',
      items: [
        { key: 'birthDate', type: 'field', dataType: 'date', label: 'Birth Date' },
      ],
    });

    const row = within(screen.getByTestId('field-birthDate'));
    const labelText = row.getByText('Birth Date');
    const typeToken = row.getByText('date');
    const keyText = row.getByText('birthDate');
    const keyRow = keyText.parentElement?.parentElement;

    expect(keyRow).toContainElement(typeToken);
    expect(labelText.parentElement).not.toContainElement(typeToken);
  });

  it('supports inline behavior editing for selected rows via BindCard and AddBehaviorMenu', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-behavior', version: '1.0.0',
      items: [
        { key: 'dob', type: 'field', dataType: 'date', label: 'Date of Birth' },
      ],
    };
    const { project } = renderTree(definition);

    const row = within(screen.getByTestId('field-dob'));
    fireEvent.click(row.getByRole('button', { name: 'Select Date of Birth' }));
    fireEvent.click(row.getByTestId('field-dob-category-Validation'));
    fireEvent.click(row.getByRole('button', { name: /Add validation rule/i }));
    fireEvent.click(row.getByRole('button', { name: /Required/i }));

    // Verify required was added
    const binds = (project.definition as any).binds ?? [];
    expect(binds).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'dob', required: 'true' }),
    ]));
  });

  it('supports option editing for selected choice fields via options modal', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-options', version: '1.0.0',
      items: [
        { key: 'status', type: 'field', dataType: 'choice', label: 'Status', options: [{ value: 'new', label: 'New' }] },
      ],
    };
    const { project } = renderTree(definition);

    fireEvent.click(within(screen.getByTestId('field-status')).getByRole('button', { name: 'Select Status' }));
    // Click the Options category slot value in the summary grid to open the modal
    fireEvent.click(within(screen.getByTestId('field-status-summary')).getByText('1 choice'));

    // OptionsModal uses non-prefixed aria labels
    const modal = screen.getByRole('dialog', { name: 'Edit options for Status' });
    fireEvent.change(within(modal).getByLabelText('Option 1 value'), { target: { value: 'open' } });
    fireEvent.change(within(modal).getByLabelText('Option 1 label'), { target: { value: 'Open' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Add option to Status' }));

    expect((project.definition.items[0] as any)?.options).toEqual([
      { value: 'open', label: 'Open' },
      { value: '', label: '' },
    ]);
  });

  it('supports removing options from selected choice fields via options modal', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-option-removal', version: '1.0.0',
      items: [
        {
          key: 'status',
          type: 'field',
          dataType: 'choice',
          label: 'Status',
          options: [
            { value: 'new', label: 'New' },
            { value: 'open', label: 'Open' },
          ],
        },
      ],
    };
    const { project } = renderTree(definition);

    fireEvent.click(within(screen.getByTestId('field-status')).getByRole('button', { name: 'Select Status' }));
    // Click "2 choices" in the category grid to open the options modal
    fireEvent.click(within(screen.getByTestId('field-status-summary')).getByText('2 choices'));
    const modal = screen.getByRole('dialog', { name: 'Edit options for Status' });
    fireEvent.click(within(modal).getByRole('button', { name: 'Remove option 1 from Status' }));

    expect((project.definition.items[0] as any)?.options).toEqual([
      { value: 'open', label: 'Open' },
    ]);
  });

  it('supports inline pre-populate editing via PrePopulateCard', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-prepopulate', version: '1.0.0',
      items: [
        { key: 'accountNumber', type: 'field', dataType: 'string', label: 'Account Number' },
      ],
    };
    const { project } = renderTree(definition);

    const row = within(screen.getByTestId('field-accountNumber'));
    fireEvent.click(row.getByRole('button', { name: 'Select Account Number' }));

    fireEvent.click(row.getByTestId('field-accountNumber-category-Value'));

    // Use AddBehaviorMenu to add pre-populate
    const addMenu = row.getByRole('button', { name: /Add Calculation/i });
    fireEvent.click(addMenu);
    fireEvent.click(row.getByRole('button', { name: /Pre-populate/i }));

    // PrePopulateCard should appear with instance/path inputs
    expect((project.definition.items[0] as any)?.prePopulate).toEqual({ instance: '', path: '' });
  });

  it('supports inline content editing for selected group rows', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-group-content', version: '1.0.0',
      items: [
        { key: 'contact', type: 'group', label: 'Contact', children: [] },
      ],
    };
    const { project } = renderTree(definition);

    fireEvent.click(within(screen.getByTestId('group-contact')).getByRole('button', { name: 'Select group Contact' }));
    fireEvent.click(within(screen.getByTestId('group-contact')).getByRole('button', { name: 'Add description to Contact' }));

    fireEvent.change(within(screen.getByTestId('group-contact')).getByLabelText('Inline group description'), { target: { value: 'Primary household contact details.' } });
    fireEvent.click(within(screen.getByTestId('group-contact')).getByRole('button', { name: 'Add hint to Contact' }));
    fireEvent.change(within(screen.getByTestId('group-contact')).getByLabelText('Inline group hint'), { target: { value: 'Use the person we should call first.' } });
    fireEvent.blur(within(screen.getByTestId('group-contact')).getByLabelText('Inline group hint'));

    expect((project.definition.items[0] as any)?.description).toBe('Primary household contact details.');
    expect((project.definition.items[0] as any)?.hint).toBe('Use the person we should call first.');
  });

  it('supports inline behavior editing for selected group rows', () => {
    const definition = {
      $formspec: '1.0', url: 'urn:tree-inline-group-behavior', version: '1.0.0',
      items: [
        { key: 'eligibility', type: 'group', label: 'Eligibility', children: [] },
      ],
    };
    const { project } = renderTree(definition);

    fireEvent.click(within(screen.getByTestId('group-eligibility')).getByRole('button', { name: 'Select group Eligibility' }));
    fireEvent.click(within(screen.getByTestId('group-eligibility')).getByRole('button', { name: 'Add behavior to Eligibility' }));

    fireEvent.click(within(screen.getByTestId('group-eligibility')).getByLabelText('Group required behavior'));
    fireEvent.change(within(screen.getByTestId('group-eligibility')).getByLabelText('Group relevant behavior'), { target: { value: '../age >= 18' } });

    const binds = (project.definition as any).binds ?? [];
    expect(binds).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'eligibility', required: 'true', relevant: '../age >= 18' }),
    ]));
  });

  it('moves focus into the lower panel when a field is expanded and back to the row when collapsed', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-focus-management', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
        { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
      ],
    });

    const nameRow = screen.getByTestId('field-name');
    const selectButton = within(nameRow).getByRole('button', { name: 'Select Full Name' });

    fireEvent.click(selectButton);
    fireEvent.click(within(nameRow).getByTestId('field-name-category-Visibility'));

    const lowerPanel = within(nameRow).getByTestId('field-name-lower-panel');
    expect(lowerPanel).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(lowerPanel);

    // Click another field to collapse the first one
    const ageRow = screen.getByTestId('field-age');
    fireEvent.click(within(ageRow).getByRole('button', { name: 'Select Age' }));
    fireEvent.click(within(ageRow).getByTestId('field-age-category-Visibility'));

    const ageLowerPanel = within(ageRow).getByTestId('field-age-lower-panel');
    expect(document.activeElement).toBe(ageLowerPanel);
  });

  it('shows fixed category slots (Visibility, Validation, Value, Format) for field summary grid', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-category-grid-field', version: '1.0.0',
      items: [
        {
          key: 'amount',
          type: 'field',
          dataType: 'money',
          label: 'Amount',
          currency: 'USD',
          precision: 2,
        },
      ],
      binds: [
        { path: 'amount', required: 'true', relevant: '$enabled = true', constraint: '. > 0' },
      ],
    });

    const summary = within(screen.getByTestId('field-amount-summary'));
    const terms = summary.getAllByRole('term');
    expect(terms).toHaveLength(4);
    expect(terms[0]).toHaveTextContent('Visibility');
    expect(terms[1]).toHaveTextContent('Validation');
    expect(terms[2]).toHaveTextContent('Value');
    expect(terms[3]).toHaveTextContent('Format');

    // Values come from buildCategorySummaries
    expect(summary.getByText(/Enabled is Yes/)).toBeInTheDocument();
    expect(summary.getByText('2 rules')).toBeInTheDocument();
    expect(summary.getByText('USD 2dp')).toBeInTheDocument();
  });

  it('renders category slots as read-only indicators without inline editing', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-category-readonly', version: '1.0.0',
      items: [
        {
          key: 'amount',
          type: 'field',
          dataType: 'money',
          label: 'Amount',
        },
      ],
      binds: [
        { path: 'amount', required: 'true' },
      ],
    });

    const row = within(screen.getByTestId('field-amount'));
    fireEvent.click(row.getByRole('button', { name: 'Select Amount' }));

    const summary = within(screen.getByTestId('field-amount-summary'));
    // Click the Validation category slot
    fireEvent.click(summary.getByText('1 rule'));

    // No inline input should appear — category slots are read-only indicators
    expect(summary.queryByRole('textbox')).toBeNull();
  });

  it('shows "Always" for visibility and em-dash for empty categories on a bare field', () => {
    renderTree({
      $formspec: '1.0', url: 'urn:tree-category-defaults', version: '1.0.0',
      items: [
        { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
      ],
    });

    const summary = within(screen.getByTestId('field-name-summary'));
    expect(summary.getByText('Always')).toBeInTheDocument();
    // em-dash for empty categories
    const dashes = summary.getAllByText('\u2014');
    expect(dashes.length).toBe(3); // Validation, Value, Format
  });

  it('scrolls the selected group or field into view when selection changes externally', () => {
    const definition = {
      $formspec: '1.0' as const,
      url: 'urn:tree-scroll-test',
      version: '1.0.0',
      title: 'Tree scroll test',
      items: [{
        key: 'contact', type: 'group' as const, label: 'Contact',
        children: [
          { key: 'email', type: 'field' as const, dataType: 'string' as const, label: 'Email' },
        ],
      }],
    };
    const project = createProject({ seed: { definition } });
    const scrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollCalls: string[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    HTMLElement.prototype.scrollIntoView = function scrollIntoViewSpy() {
      const path = this.getAttribute('data-editor-path');
      if (path) scrollCalls.push(path);
    };

    function SelectButton({ path, type }: { path: string; type: string }) {
      const { select } = useSelection();
      return (
        <button
          type="button"
          data-testid={`select-${path}`}
          onClick={() => select(path, type, { tab: 'editor' })}
        >
          Select
        </button>
      );
    }

    try {
      render(
        <ProjectProvider project={project}>
          <SelectionProvider>
            <DefinitionTreeEditor />
            <SelectButton path="contact" type="group" />
            <SelectButton path="contact.email" type="field" />
          </SelectionProvider>
        </ProjectProvider>,
      );

      fireEvent.click(screen.getByTestId('select-contact'));
      fireEvent.click(screen.getByTestId('select-contact.email'));

      expect(scrollCalls).toContain('contact');
      expect(scrollCalls).toContain('contact.email');
    } finally {
      HTMLElement.prototype.scrollIntoView = scrollIntoView;
      requestAnimationFrameSpy.mockRestore();
    }
  });
});
