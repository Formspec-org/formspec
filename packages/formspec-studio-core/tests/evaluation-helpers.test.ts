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

  it('excludes hidden required fields from requiredFields', () => {
    const project = createProject();
    project.addField('toggle', 'Toggle', 'boolean');
    project.addGroup('details', 'Details');
    project.addField('details.name', 'Name', 'text');
    project.require('details.name');
    project.showWhen('details', '$toggle = true');

    // toggle defaults to falsy, so 'details' group is hidden
    const preview = previewForm(project);
    expect(preview.requiredFields).not.toContain('details.name');
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

  it('email constraint rejects "a@b" (no TLD)', () => {
    const project = createProject();
    project.addField('email', 'Email', 'email');
    const preview = previewForm(project, { email: 'a@b' });
    expect(preview.validationState['email']).toBeDefined();
  });

  it('email constraint accepts "user@example.com"', () => {
    const project = createProject();
    project.addField('email', 'Email', 'email');
    const preview = previewForm(project, { email: 'user@example.com' });
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

  it('uses consistent 0-based paths across all output sections', () => {
    const project = buildExpenseForm();
    project.require('expenses.amount');

    // No scenario — default instance has empty amount → required error
    const preview = previewForm(project);

    // visibleFields uses 0-based paths from engine signals
    const visibleRepeatPaths = preview.visibleFields.filter(p => p.includes('['));
    expect(visibleRepeatPaths.length).toBeGreaterThan(0);
    for (const p of visibleRepeatPaths) {
      expect(p).toMatch(/\[0\]/);
      expect(p).not.toMatch(/\[1\]/);
    }

    // requiredFields should also be 0-based
    const requiredRepeatPaths = preview.requiredFields.filter(p => p.includes('['));
    expect(requiredRepeatPaths.length).toBeGreaterThan(0);
    for (const p of requiredRepeatPaths) {
      expect(p).toMatch(/\[0\]/);
      expect(p).not.toMatch(/\[1\]/);
    }

    // currentValues should be 0-based
    const valueRepeatKeys = Object.keys(preview.currentValues).filter(p => p.includes('['));
    expect(valueRepeatKeys.length).toBeGreaterThan(0);
    for (const p of valueRepeatKeys) {
      expect(p).toMatch(/\[0\]/);
      expect(p).not.toMatch(/\[1\]/);
    }

    // validationState must also be 0-based — this was the bug
    const validationRepeatKeys = Object.keys(preview.validationState).filter(p => p.includes('['));
    expect(validationRepeatKeys.length).toBeGreaterThan(0);
    for (const p of validationRepeatKeys) {
      expect(p).toMatch(/\[0\]/);
      expect(p).not.toMatch(/\[1\]/);
    }
  });

  it('multiple instances all use 0-based paths in validationState', () => {
    const project = buildExpenseForm();
    project.require('expenses.amount');

    // Two instances, both with empty required field
    const preview = previewForm(project, {
      'expenses[0].description': 'Travel',
      'expenses[1].description': 'Food',
    });

    // Both instances should have required errors at 0-based paths
    expect(preview.validationState['expenses[0].amount']).toBeDefined();
    expect(preview.validationState['expenses[0].amount'].message).toBe('Required');
    expect(preview.validationState['expenses[1].amount']).toBeDefined();
    expect(preview.validationState['expenses[1].amount'].message).toBe('Required');

    // No 1-based or 2-based phantom paths
    expect(preview.validationState['expenses[2].amount']).toBeUndefined();
  });

  it('validation paths match currentValues paths for the same instance', () => {
    const project = buildExpenseForm();
    project.require('expenses.amount');
    project.require('expenses.description');

    const preview = previewForm(project);

    // Every validation path should have a corresponding currentValues entry
    for (const valPath of Object.keys(preview.validationState)) {
      if (valPath.includes('[')) {
        expect(preview.currentValues).toHaveProperty(valPath);
      }
    }

    // Every currentValues repeat path should appear in visibleFields
    for (const cvPath of Object.keys(preview.currentValues)) {
      if (cvPath.includes('[')) {
        expect(preview.visibleFields).toContain(cvPath);
      }
    }
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

  it('returns 0-based paths for repeat group validation errors', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.makeRepeatable('items', { min: 1 });
    project.addField('items.name', 'Name', 'text');
    project.require('items.name');

    const report = validateResponse(project, {
      items: [{ name: '' }],
    });
    expect(report.valid).toBe(false);
    // Paths should be 0-based (items[0].name), not 1-based (items[1].name)
    const paths = report.results.map(r => r.path);
    expect(paths.some(p => p.includes('[0]'))).toBe(true);
    expect(paths.some(p => p.includes('[1]'))).toBe(false);
  });
});

describe('previewForm — per-page validation counts', () => {
  function buildWizardForm() {
    const project = createProject();
    project.addPage('Personal Info', undefined, 'personal');
    project.addPage('Address', undefined, 'address');

    // addPage('...', undefined, 'personal') creates group key 'personal'
    project.addField('personal.first_name', 'First Name', 'text');
    project.addField('personal.last_name', 'Last Name', 'text');
    project.require('personal.first_name');
    project.require('personal.last_name');

    // addPage('...', undefined, 'address') creates group key 'address'
    project.addField('address.street', 'Street', 'text');
    project.addField('address.city', 'City', 'text');
    project.require('address.street');

    return project;
  }

  it('includes validationErrors count on each page entry', () => {
    const project = buildWizardForm();
    const preview = previewForm(project);

    // All required fields are empty — errors on both pages
    const personalPage = preview.pages.find(p => p.id === 'personal');
    const addressPage = preview.pages.find(p => p.id === 'address');

    expect(personalPage).toBeDefined();
    expect(addressPage).toBeDefined();
    expect(personalPage!.validationErrors).toBe(2); // first_name + last_name
    expect(addressPage!.validationErrors).toBe(1);  // street only
  });

  it('page with no errors has validationErrors: 0', () => {
    const project = buildWizardForm();
    const preview = previewForm(project, {
      'personal.first_name': 'Alice',
      'personal.last_name': 'Smith',
    });

    const personalPage = preview.pages.find(p => p.id === 'personal');
    expect(personalPage!.validationErrors).toBe(0);
  });

  it('does not count errors for hidden fields', () => {
    const project = createProject();
    project.addPage('Main', undefined, 'main');
    project.addField('main.toggle', 'Show Details', 'boolean');
    project.addField('main.details', 'Details', 'text');
    project.require('main.details');
    project.showWhen('main.details', '$main.toggle = true');

    const preview = previewForm(project);

    // toggle is false by default, so details is hidden — its required error shouldn't count
    const mainPage = preview.pages.find(p => p.id === 'main');
    expect(mainPage!.validationErrors).toBe(0);
  });

  it('counts warnings separately from errors', () => {
    const project = createProject();
    project.addPage('Info', undefined, 'info');
    project.addField('info.code', 'Code', 'text');
    project.require('info.code');
    project.addValidation('info.code', "matches($info.code, '^[A-Z]+$')", 'Prefer uppercase', { severity: 'warning' });

    const preview = previewForm(project, { 'info.code': 'abc' });

    const infoPage = preview.pages.find(p => p.id === 'info');
    expect(infoPage!.validationErrors).toBe(0);    // code is provided, so not "Required"
    expect(infoPage!.validationWarnings).toBe(1);   // warning from the matches rule
  });

  it('returns 0 counts for pages with no fields', () => {
    const project = createProject();
    project.addPage('Empty Page', undefined, 'empty');

    const preview = previewForm(project);
    const emptyPage = preview.pages.find(p => p.id === 'empty');
    expect(emptyPage!.validationErrors).toBe(0);
    expect(emptyPage!.validationWarnings).toBe(0);
  });

  it('handles form with no pages (single-page mode)', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.require('name');

    const preview = previewForm(project);
    expect(preview.pages).toHaveLength(0);
  });

  it('counts errors in repeat group fields on a page', () => {
    const project = createProject();
    project.addPage('Items', undefined, 'items');
    project.addGroup('items.line_items', 'Line Items');
    project.makeRepeatable('items.line_items', { min: 1 });
    project.addField('items.line_items.amount', 'Amount', 'decimal');
    project.require('items.line_items.amount');

    // Two instances, both with empty required field
    const preview = previewForm(project, {
      'items.line_items[0].amount': undefined,
      'items.line_items[1].amount': undefined,
    });

    const itemsPage = preview.pages.find(p => p.id === 'items');
    expect(itemsPage!.validationErrors).toBe(2);
  });

  it('validateResponse keeps repeat-row required errors when scenario uses explicit undefined', () => {
    const project = createProject();
    project.addGroup('line_items', 'Line Items');
    project.makeRepeatable('line_items', { min: 1 });
    project.addField('line_items.amount', 'Amount', 'decimal');
    project.require('line_items.amount');

    const report = validateResponse(project, {
      'line_items[0].amount': undefined,
      'line_items[1].amount': undefined,
    });

    expect(report.counts.error).toBe(2);
    expect(report.results.map(r => r.path)).toEqual([
      'line_items[0].amount',
      'line_items[1].amount',
    ]);
  });

  it('errors on all pages are independent', () => {
    const project = createProject();
    project.addPage('Page A', undefined, 'page-a');
    project.addPage('Page B', undefined, 'page-b');

    project.addField('page_a.x', 'X', 'text');
    project.require('page_a.x');
    project.addField('page_b.y', 'Y', 'text');
    project.addField('page_b.z', 'Z', 'text');
    project.require('page_b.y');
    project.require('page_b.z');

    const preview = previewForm(project);

    const pageA = preview.pages.find(p => p.id === 'page-a');
    const pageB = preview.pages.find(p => p.id === 'page-b');
    expect(pageA!.validationErrors).toBe(1);
    expect(pageB!.validationErrors).toBe(2);
  });

  it('filling all required fields brings page errors to 0', () => {
    const project = createProject();
    project.addPage('Contact', undefined, 'contact');
    project.addField('contact.name', 'Name', 'text');
    project.addField('contact.email', 'Email', 'email');
    project.require('contact.name');
    project.require('contact.email');

    // Fill everything
    const preview = previewForm(project, {
      'contact.name': 'Alice',
      'contact.email': 'alice@example.com',
    });

    const contactPage = preview.pages.find(p => p.id === 'contact');
    expect(contactPage!.validationErrors).toBe(0);
    expect(contactPage!.validationWarnings).toBe(0);
  });
});

describe('previewForm — multichoice fields', () => {
  it('multichoice scenario array drives selected() in show_when', () => {
    const project = createProject();
    project.addField('sessions', 'Sessions', 'multichoice', {
      choices: [
        { value: 'keynote', label: 'Keynote' },
        { value: 'workshop', label: 'Workshop' },
        { value: 'panel', label: 'Panel' },
      ],
    });
    project.addField('workshop_topic', 'Workshop Topic', 'text');
    project.showWhen('workshop_topic', "selected($sessions, 'workshop')");

    // Scenario passes multichoice array — workshop_topic should be visible
    const preview = previewForm(project, {
      sessions: ['keynote', 'workshop'],
    });

    expect(preview.visibleFields).toContain('workshop_topic');
    expect(preview.currentValues['sessions']).toEqual(['keynote', 'workshop']);
  });

  it('multichoice scenario array without matching value hides conditional field', () => {
    const project = createProject();
    project.addField('sessions', 'Sessions', 'multichoice', {
      choices: [
        { value: 'keynote', label: 'Keynote' },
        { value: 'workshop', label: 'Workshop' },
      ],
    });
    project.addField('workshop_topic', 'Workshop Topic', 'text');
    project.showWhen('workshop_topic', "selected($sessions, 'workshop')");

    // Only keynote selected — workshop_topic should be hidden
    const preview = previewForm(project, {
      sessions: ['keynote'],
    });

    expect(preview.hiddenFields.some(h => h.path === 'workshop_topic')).toBe(true);
  });

  it('multichoice empty array keeps conditional field hidden', () => {
    const project = createProject();
    project.addField('sessions', 'Sessions', 'multichoice', {
      choices: [
        { value: 'keynote', label: 'Keynote' },
        { value: 'workshop', label: 'Workshop' },
      ],
    });
    project.addField('workshop_topic', 'Workshop Topic', 'text');
    project.showWhen('workshop_topic', "selected($sessions, 'workshop')");

    const preview = previewForm(project, {
      sessions: [],
    });

    expect(preview.hiddenFields.some(h => h.path === 'workshop_topic')).toBe(true);
  });

  it('multichoice calculate using count() works with scenario', () => {
    const project = createProject();
    project.addField('tags', 'Tags', 'multichoice', {
      choices: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
      ],
    });
    project.addField('tag_count', 'Tag Count', 'integer');
    project.calculate('tag_count', 'count($tags)');

    const preview = previewForm(project, {
      tags: ['a', 'c'],
    });

    expect(preview.currentValues['tag_count']).toBe(2);
  });
});

describe('validateResponse — multichoice fields', () => {
  it('multichoice array passes required validation', () => {
    const project = createProject();
    project.addField('sessions', 'Sessions', 'multichoice', {
      choices: [
        { value: 'keynote', label: 'Keynote' },
        { value: 'workshop', label: 'Workshop' },
      ],
    });
    project.require('sessions');

    const report = validateResponse(project, {
      sessions: ['keynote', 'workshop'],
    });
    expect(report.valid).toBe(true);
  });

  it('multichoice empty array fails required validation', () => {
    const project = createProject();
    project.addField('sessions', 'Sessions', 'multichoice', {
      choices: [
        { value: 'keynote', label: 'Keynote' },
        { value: 'workshop', label: 'Workshop' },
      ],
    });
    project.require('sessions');

    const report = validateResponse(project, {
      sessions: [],
    });
    expect(report.valid).toBe(false);
  });
});

describe('previewForm — multichoice and repeat groups coexist', () => {
  it('multichoice arrays pass through while repeat group arrays expand', () => {
    const project = createProject();

    // Repeat group — array should be expanded into indexed paths
    project.addGroup('items', 'Items');
    project.makeRepeatable('items', { min: 1 });
    project.addField('items.name', 'Name', 'text');

    // Multichoice field — array should be passed through as-is
    project.addField('categories', 'Categories', 'multichoice', {
      choices: [
        { value: 'food', label: 'Food' },
        { value: 'travel', label: 'Travel' },
      ],
    });

    const preview = previewForm(project, {
      items: [{ name: 'Widget' }],
      categories: ['food', 'travel'],
    });

    // Repeat group expanded correctly
    expect(preview.currentValues['items[0].name']).toBe('Widget');
    // Multichoice preserved as array
    expect(preview.currentValues['categories']).toEqual(['food', 'travel']);
  });

  it('nested multichoice inside a non-repeat group passes through', () => {
    const project = createProject();
    project.addGroup('prefs', 'Preferences');
    project.addField('prefs.colors', 'Colors', 'multichoice', {
      choices: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
    });

    const preview = previewForm(project, {
      prefs: { colors: ['red', 'blue'] },
    });

    expect(preview.currentValues['prefs.colors']).toEqual(['red', 'blue']);
  });

  it('nested repeat group arrays still expand correctly via flat paths', () => {
    const project = createProject();
    project.addGroup('sections', 'Sections');
    project.makeRepeatable('sections', { min: 1 });
    project.addGroup('sections.items', 'Items');
    project.makeRepeatable('sections.items', { min: 1 });
    project.addField('sections.items.value', 'Value', 'text');

    // Use flat indexed paths for nested repeat groups.
    // Nested object expansion for multiply-nested repeats has a pre-existing
    // limitation in the repeat count detection regex (separate from this fix).
    const preview = previewForm(project, {
      'sections[0].items[0].value': 'A',
    });

    expect(preview.currentValues['sections[0].items[0].value']).toBe('A');
  });

  it('repeat group with flat indexed keys still works (regression)', () => {
    const project = createProject();
    project.addGroup('rows', 'Rows');
    project.makeRepeatable('rows', { min: 1 });
    project.addField('rows.label', 'Label', 'text');

    // Already-flat paths should bypass flattening entirely
    const preview = previewForm(project, {
      'rows[0].label': 'First',
      'rows[1].label': 'Second',
    });

    expect(preview.currentValues['rows[0].label']).toBe('First');
    expect(preview.currentValues['rows[1].label']).toBe('Second');
  });

  it('validateResponse with multichoice + repeat group in same form', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.makeRepeatable('items', { min: 1 });
    project.addField('items.name', 'Name', 'text');
    project.require('items.name');

    project.addField('tags', 'Tags', 'multichoice', {
      choices: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });
    project.require('tags');

    const report = validateResponse(project, {
      items: [{ name: 'Widget' }],
      tags: ['a', 'b'],
    });
    expect(report.valid).toBe(true);
  });

  it('validateResponse with empty multichoice + valid repeat group', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.makeRepeatable('items', { min: 1 });
    project.addField('items.name', 'Name', 'text');
    project.require('items.name');

    project.addField('tags', 'Tags', 'multichoice', {
      choices: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });
    project.require('tags');

    const report = validateResponse(project, {
      items: [{ name: 'Widget' }],
      tags: [],
    });
    // Items valid, but tags empty + required → invalid
    expect(report.valid).toBe(false);
    expect(report.results.some(r => r.path === 'tags')).toBe(true);
  });
});
