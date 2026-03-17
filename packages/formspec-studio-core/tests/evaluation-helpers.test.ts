import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project.js';
import { previewForm, validateResponse } from '../src/evaluation-helpers.js';

describe('previewForm', () => {
  it('returns visible fields for a simple form', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addField('email', 'Email', 'email');

    const preview = previewForm(project);
    expect(preview.visibleFields).toContain('name');
    expect(preview.visibleFields).toContain('email');
  });

  it('hides fields with unsatisfied relevant condition', () => {
    const project = createProject();
    project.addField('show_details', 'Show Details', 'boolean');
    project.addField('details', 'Details', 'text');
    project.showWhen('details', 'show_details = true');

    const preview = previewForm(project);
    // show_details defaults to falsy, so details should be hidden
    expect(preview.hiddenFields.some(h => h.path === 'details')).toBe(true);
  });

  it('applies scenario values', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');

    const preview = previewForm(project, { name: 'Alice' });
    expect(preview.currentValues['name']).toBe('Alice');
  });

  it('shows required fields', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.require('name');

    const preview = previewForm(project);
    expect(preview.requiredFields).toContain('name');
  });

  it('includes shape validation messages in validationState', () => {
    const project = createProject();
    project.addField('email', 'Email', 'email');
    // Shape fires when constraint fails — use a constraint that fails when value is empty
    project.addValidation('email', '$email != ""', 'Please enter a valid email');

    const preview = previewForm(project);
    // No scenario values — email is empty — shape should fire with the custom message
    expect(preview.validationState['email']).toBeDefined();
    expect(preview.validationState['email'].message).toBe('Please enter a valid email');
  });

  it('shape custom message wins over bind-level "Invalid" for email field with invalid value', () => {
    // Regression: previewForm was showing "Invalid" (bind-level fallback) instead of the
    // custom message from an add_rule shape when the email field had a non-empty invalid value.
    // The email type auto-injects a bind constraint (matches(@, '.*@.*')) with no constraintMessage,
    // which falls back to "Invalid". The shape message must win.
    const project = createProject();
    project.addField('email', 'Email', 'email');
    project.addValidation('email', "matches($email, '.*@.*')", 'Please enter a valid email');

    // Non-empty invalid email triggers both the auto-injected bind constraint AND the shape
    const preview = previewForm(project, { email: 'notanemail' });
    expect(preview.validationState['email']).toBeDefined();
    expect(preview.validationState['email'].message).toBe('Please enter a valid email');
  });

  it('shape message is visible in preview even when timing is submit', () => {
    // If add_rule is called with timing:'submit', the shape is not in shapeResults signals.
    // previewForm must still surface submit-timing shapes so custom messages aren't hidden.
    const project = createProject();
    project.addField('email', 'Email', 'email');
    project.addValidation('email', "matches($email, '.*@.*')", 'Please enter a valid email', { timing: 'submit' });

    const preview = previewForm(project, { email: 'notanemail' });
    expect(preview.validationState['email']).toBeDefined();
    expect(preview.validationState['email'].message).toBe('Please enter a valid email');
  });

  it('required email with empty value shows "Required", not "Invalid"', () => {
    // P2-1: required + email constraint on empty value. The engine should skip the
    // bind constraint on empty values (spec §3.8.1). Only "Required" should appear.
    const project = createProject();
    project.addField('email', 'Email', 'email');
    project.require('email');

    const preview = previewForm(project);
    expect(preview.validationState['email']).toBeDefined();
    expect(preview.validationState['email'].message).toBe('Required');
    expect(preview.validationState['email'].severity).toBe('error');
  });

  it('"required" error takes priority over "constraint" error for same field', () => {
    // Bug B: when multiple errors exist for the same path, the priority logic
    // must prefer constraintKind:"required" over constraintKind:"constraint",
    // not just last-write-wins among same-severity errors.
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.require('name');
    // Shape that also fails on empty value — produces a second error
    project.addValidation('name', '$name != ""', 'Name is invalid');

    const preview = previewForm(project);
    expect(preview.validationState['name']).toBeDefined();
    expect(preview.validationState['name'].message).toBe('Required');
  });

  it('error severity wins over warning regardless of order', () => {
    const project = createProject();
    project.addField('code', 'Code', 'text');
    // Error-level shape
    project.addValidation('code', '$code != ""', 'Code is required');
    // Warning-level shape (added second — would be last-write in buggy version)
    project.addValidation('code', "matches($code, '^[A-Z]+$')", 'Prefer uppercase', { severity: 'warning' });

    const preview = previewForm(project);
    expect(preview.validationState['code']).toBeDefined();
    expect(preview.validationState['code'].severity).toBe('error');
    expect(preview.validationState['code'].message).toBe('Code is required');
  });

  it('non-required email with empty value has no validation errors', () => {
    const project = createProject();
    project.addField('email', 'Email', 'email');

    const preview = previewForm(project);
    // No required, and constraint should be skipped on empty value
    expect(preview.validationState['email']).toBeUndefined();
  });
});

describe('previewForm — parent group visibility inheritance', () => {
  it('hides child fields when parent group is hidden', () => {
    const project = createProject();
    project.addField('toggle', 'Toggle', 'boolean');
    project.addGroup('details', 'Details');
    project.addField('details.name', 'Name', 'text');
    project.addField('details.age', 'Age', 'integer');
    project.showWhen('details', '$toggle = true');

    // toggle defaults to falsy, so 'details' group is hidden
    const preview = previewForm(project);

    // Children must be in hiddenFields, not visibleFields
    expect(preview.visibleFields).not.toContain('details.name');
    expect(preview.visibleFields).not.toContain('details.age');
    expect(preview.hiddenFields.some(h => h.path === 'details.name')).toBe(true);
    expect(preview.hiddenFields.some(h => h.path === 'details.age')).toBe(true);
  });

  it('populates hiddenBy with the ancestor that caused hiding', () => {
    const project = createProject();
    project.addField('toggle', 'Toggle', 'boolean');
    project.addGroup('details', 'Details');
    project.addField('details.name', 'Name', 'text');
    project.showWhen('details', '$toggle = true');

    const preview = previewForm(project);

    const hidden = preview.hiddenFields.find(h => h.path === 'details.name');
    expect(hidden).toBeDefined();
    expect(hidden!.hiddenBy).toBe('details');
  });

  it('hides grandchildren when grandparent group is hidden', () => {
    const project = createProject();
    project.addField('toggle', 'Toggle', 'boolean');
    project.addGroup('outer', 'Outer');
    project.addGroup('outer.inner', 'Inner');
    project.addField('outer.inner.value', 'Value', 'text');
    project.showWhen('outer', '$toggle = true');

    const preview = previewForm(project);

    expect(preview.visibleFields).not.toContain('outer.inner.value');
    expect(preview.hiddenFields.some(h => h.path === 'outer.inner.value')).toBe(true);
    // hiddenBy should point to the outermost hidden ancestor
    const hidden = preview.hiddenFields.find(h => h.path === 'outer.inner.value');
    expect(hidden!.hiddenBy).toBe('outer');
  });

  it('child with own show_when=true is still hidden if parent is hidden', () => {
    const project = createProject();
    project.addField('toggle', 'Toggle', 'boolean');
    project.addGroup('details', 'Details');
    project.addField('details.name', 'Name', 'text');
    project.showWhen('details', '$toggle = true');
    // Child has its own show_when that evaluates to true, but parent overrides
    project.showWhen('details.name', 'true');

    const preview = previewForm(project);

    expect(preview.visibleFields).not.toContain('details.name');
    expect(preview.hiddenFields.some(h => h.path === 'details.name')).toBe(true);
  });

  it('shows children when parent group is visible', () => {
    const project = createProject();
    project.addField('toggle', 'Toggle', 'boolean');
    project.addGroup('details', 'Details');
    project.addField('details.name', 'Name', 'text');
    project.showWhen('details', '$toggle = true');

    // Scenario makes toggle true, so parent is visible
    const preview = previewForm(project, { toggle: true });

    expect(preview.visibleFields).toContain('details.name');
    expect(preview.hiddenFields.some(h => h.path === 'details.name')).toBe(false);
  });

  it('hides repeat group children when parent group is hidden', () => {
    const project = createProject();
    project.addField('show_items', 'Show Items', 'boolean');
    project.addGroup('items', 'Items');
    project.makeRepeatable('items', { min: 1 });
    project.addField('items.name', 'Name', 'text');
    project.showWhen('items', '$show_items = true');

    const preview = previewForm(project);

    // items[0].name should be hidden because parent 'items' is hidden
    expect(preview.visibleFields).not.toContain('items[0].name');
    expect(preview.hiddenFields.some(h => h.path === 'items[0].name')).toBe(true);
  });

  it('hiddenBy for repeat group child points to hidden group', () => {
    const project = createProject();
    project.addField('show_items', 'Show Items', 'boolean');
    project.addGroup('items', 'Items');
    project.makeRepeatable('items', { min: 1 });
    project.addField('items.name', 'Name', 'text');
    project.showWhen('items', '$show_items = true');

    const preview = previewForm(project);

    const hidden = preview.hiddenFields.find(h => h.path === 'items[0].name');
    expect(hidden).toBeDefined();
    expect(hidden!.hiddenBy).toBe('items');
  });
});

describe('previewForm — repeat groups', () => {
  function buildExpenseForm() {
    const project = createProject();
    project.addGroup('expenses', 'Expenses');
    project.makeRepeatable('expenses', { min: 1 });
    project.addField('expenses.amount', 'Amount', 'decimal');
    project.addField('expenses.description', 'Description', 'text');
    return project;
  }

  it('populates multi-instance scenario data', () => {
    const project = buildExpenseForm();

    const preview = previewForm(project, {
      'expenses[0].amount': 100,
      'expenses[0].description': 'Travel',
      'expenses[1].amount': 200,
      'expenses[1].description': 'Food',
    });

    expect(preview.currentValues['expenses[0].amount']).toBe(100);
    expect(preview.currentValues['expenses[0].description']).toBe('Travel');
    expect(preview.currentValues['expenses[1].amount']).toBe(200);
    expect(preview.currentValues['expenses[1].description']).toBe('Food');
  });

  it('supports calculated aggregates over repeat instances', () => {
    const project = buildExpenseForm();
    project.addField('total', 'Total', 'decimal');
    project.calculate('total', 'sum($expenses[*].amount)');

    const preview = previewForm(project, {
      'expenses[0].amount': 100,
      'expenses[1].amount': 200,
    });

    expect(preview.currentValues['total']).toBe(300);
  });

  it('accepts nested object format in scenario', () => {
    const project = buildExpenseForm();

    const preview = previewForm(project, {
      expenses: [
        { amount: 50, description: 'Lunch' },
        { amount: 75, description: 'Dinner' },
      ],
    });

    expect(preview.currentValues['expenses[0].amount']).toBe(50);
    expect(preview.currentValues['expenses[0].description']).toBe('Lunch');
    expect(preview.currentValues['expenses[1].amount']).toBe(75);
  });

  it('handles repeat group with minRepeat: 0 and scenario providing [0]', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.makeRepeatable('items', { min: 0 });
    project.addField('items.name', 'Item Name', 'text');

    const preview = previewForm(project, {
      'items[0].name': 'Widget',
    });

    expect(preview.currentValues['items[0].name']).toBe('Widget');
  });

  it('accepts nested non-repeat object format in scenario', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact Info');
    project.addField('contact.email', 'Email', 'email');
    project.addField('contact.phone', 'Phone', 'text');

    const preview = previewForm(project, {
      contact: { email: 'a@b.com', phone: '555-1234' },
    });

    expect(preview.currentValues['contact.email']).toBe('a@b.com');
    expect(preview.currentValues['contact.phone']).toBe('555-1234');
  });

  it('handles mixed flat + nested keys in same scenario', () => {
    const project = buildExpenseForm();
    project.addField('notes', 'Notes', 'text');

    const preview = previewForm(project, {
      notes: 'Some notes',
      expenses: [{ amount: 42, description: 'Taxi' }],
    });

    expect(preview.currentValues['notes']).toBe('Some notes');
    expect(preview.currentValues['expenses[0].amount']).toBe(42);
  });

  it('handles sparse indices (only [2] provided, no [0] or [1])', () => {
    const project = createProject();
    project.addGroup('rows', 'Rows');
    project.makeRepeatable('rows', { min: 0 });
    project.addField('rows.value', 'Value', 'text');

    const preview = previewForm(project, {
      'rows[2].value': 'third',
    });

    expect(preview.currentValues['rows[2].value']).toBe('third');
    expect(preview.currentValues).toHaveProperty('rows[0].value');
    expect(preview.currentValues).toHaveProperty('rows[1].value');
  });

  it('no scenario does not break repeat groups', () => {
    const project = buildExpenseForm();
    const preview = previewForm(project);

    // Should have one instance from minRepeat: 1
    expect(preview.currentValues).toHaveProperty('expenses[0].amount');
  });
});

describe('validateResponse', () => {
  it('returns valid: true for valid response', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');

    const report = validateResponse(project, { name: 'Alice' });
    expect(report.valid).toBe(true);
  });

  it('returns valid: false for missing required field', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.require('name');

    const report = validateResponse(project, {});
    expect(report.valid).toBe(false);
    expect(report.counts.error).toBeGreaterThan(0);
  });

  it('accepts nested response objects', () => {
    const project = createProject();
    project.addGroup('patient', 'Patient');
    project.addField('patient.first_name', 'First Name', 'text');
    project.addField('patient.last_name', 'Last Name', 'text');
    project.require('patient.first_name');

    const report = validateResponse(project, {
      patient: { first_name: 'John', last_name: 'Doe' },
    });
    expect(report.valid).toBe(true);
  });

  it('still works with flat dot-path keys (regression)', () => {
    const project = createProject();
    project.addGroup('patient', 'Patient');
    project.addField('patient.first_name', 'First Name', 'text');
    project.require('patient.first_name');

    const report = validateResponse(project, {
      'patient.first_name': 'Jane',
    });
    expect(report.valid).toBe(true);
  });

  it('validates repeat group data from nested response', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.makeRepeatable('items', { min: 1 });
    project.addField('items.name', 'Name', 'text');
    project.require('items.name');

    const report = validateResponse(project, {
      items: [{ name: 'Widget' }],
    });
    expect(report.valid).toBe(true);
  });

  it('catches validation errors in repeat instance data', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.makeRepeatable('items', { min: 1 });
    project.addField('items.name', 'Name', 'text');
    project.require('items.name');

    const report = validateResponse(project, {
      items: [{ name: 'Widget' }, { name: '' }],
    });
    expect(report.valid).toBe(false);
  });

  it('accepts getResponse() output as input (round-trip)', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.name', 'Name', 'text');
    project.addField('contact.email', 'Email', 'email');
    project.require('contact.name');

    const nestedResponse = { contact: { name: 'Alice', email: 'a@b.com' } };
    const report = validateResponse(project, nestedResponse);
    expect(report.valid).toBe(true);
  });

  it('validates mixed flat and nested keys', () => {
    const project = createProject();
    project.addField('top_level', 'Top', 'text');
    project.addGroup('nested', 'Nested');
    project.addField('nested.child', 'Child', 'text');
    project.require('top_level');
    project.require('nested.child');

    const report = validateResponse(project, {
      top_level: 'present',
      nested: { child: 'also present' },
    });
    expect(report.valid).toBe(true);
  });
});
