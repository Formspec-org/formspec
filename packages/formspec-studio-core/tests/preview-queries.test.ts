/** @filedesc Tests for generateSampleData and normalizeDefinition. */
import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project.js';

describe('generateSampleData', () => {
  it('generates sample values for basic field types', () => {
    const project = createProject();
    project.addField('name', 'Name', 'string');
    project.addField('bio', 'Bio', 'text');
    project.addField('age', 'Age', 'integer');
    project.addField('score', 'Score', 'decimal');
    project.addField('active', 'Active', 'boolean');
    project.addField('dob', 'Date of Birth', 'date');

    const data = project.generateSampleData();

    expect(data.name).toBe('Jane Doe'); // key contains "name"
    expect(data.bio).toBe('Sample paragraph text');
    expect(data.age).toBe(12); // varied: 10 + fieldIndex(2)
    expect(data.score).toBe(3.6); // varied: 1.5 + fieldIndex(3)*0.7
    expect(data.active).toBe(true);
    // date should be today's date in ISO format, not a hardcoded value
    expect(data.dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.dob).toBe(new Date().toISOString().slice(0, 10));
  });

  it('generates sample values for time-related types', () => {
    const project = createProject();
    project.addField('t', 'Time', 'time');
    project.addField('dt', 'DateTime', 'dateTime');

    const data = project.generateSampleData();

    expect(data.t).toBe('09:00:00');
    // dateTime should include today's date with a time component
    expect(data.dt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect((data.dt as string).slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
  });

  it('uses first choice value for select fields', () => {
    const project = createProject();
    project.addField('color', 'Color', 'choice', {
      choices: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
    });

    const data = project.generateSampleData();

    expect(data.color).toBe('red');
  });

  it('generates default option1 when no choices are defined for choice type', () => {
    const project = createProject();
    project.addField('pick', 'Pick', 'choice');

    const data = project.generateSampleData();

    expect(data.pick).toBe('option1');
  });

  it('generates money sample data', () => {
    const project = createProject();
    project.addField('price', 'Price', 'money');

    const data = project.generateSampleData();

    expect(data.price).toEqual({ amount: 100, currency: 'USD' });
  });

  it('handles fields in groups', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'email');
    project.addField('contact.phone', 'Phone', 'phone');

    const data = project.generateSampleData();

    // Group fields should use their full path; key-based heuristics apply
    expect(data['contact.email']).toBe('sample@example.com'); // key contains "email"
    expect(data['contact.phone']).toBe('+1-555-0100'); // key contains "phone"
  });

  it('returns empty object for project with no fields', () => {
    const project = createProject();

    const data = project.generateSampleData();

    expect(data).toEqual({});
  });

  it('skips group and display items', () => {
    const project = createProject();
    project.addGroup('section', 'Section');
    project.addContent('heading1', 'Welcome', 'heading');
    project.addField('q1', 'Q1', 'text');

    const data = project.generateSampleData();

    // Only the field should produce sample data
    expect(Object.keys(data)).toEqual(['q1']);
    expect(data.q1).toBe('Sample paragraph text');
  });

  it('applies overrides when provided', () => {
    const project = createProject();
    project.addField('name', 'Name', 'string');
    project.addField('age', 'Age', 'integer');

    const data = project.generateSampleData({ name: 'Alice' });

    expect(data.name).toBe('Alice');
    expect(data.age).toBe(11); // non-overridden field: 10 + fieldIndex(1)
  });

  it('overrides take precedence over generated values', () => {
    const project = createProject();
    project.addField('color', 'Color', 'choice', {
      choices: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
    });

    const data = project.generateSampleData({ color: 'green' });

    expect(data.color).toBe('green');
  });

  it('ignores overrides for paths not in the form', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');

    const data = project.generateSampleData({ nonexistent: 'value' });

    expect(data).not.toHaveProperty('nonexistent');
    expect(data.q1).toBe('Sample paragraph text');
  });

  it('excludes fields hidden by show_when conditions', () => {
    const project = createProject();
    project.addField('type', 'Type', 'choice', {
      choices: [
        { value: 'personal', label: 'Personal' },
        { value: 'business', label: 'Business' },
      ],
    });
    project.addField('company_name', 'Company Name', 'string');
    project.showWhen('company_name', '$type = \'business\'');

    // Sample data picks first option ('personal'), so company_name should be hidden
    const data = project.generateSampleData();

    expect(data.type).toBe('personal');
    expect(data).not.toHaveProperty('company_name');
  });

  it('includes conditionally-visible fields when override satisfies the condition', () => {
    const project = createProject();
    project.addField('type', 'Type', 'choice', {
      choices: [
        { value: 'personal', label: 'Personal' },
        { value: 'business', label: 'Business' },
      ],
    });
    project.addField('company_name', 'Company Name', 'string');
    project.showWhen('company_name', '$type = \'business\'');

    // Override makes the condition true
    const data = project.generateSampleData({ type: 'business' });

    expect(data.type).toBe('business');
    expect(data).toHaveProperty('company_name');
  });

  it('excludes fields inside a hidden group', () => {
    const project = createProject();
    project.addField('show_details', 'Show Details', 'boolean');
    project.addGroup('details', 'Details');
    project.addField('details.name', 'Name', 'string');
    project.addField('details.email', 'Email', 'email');
    project.showWhen('details', '$show_details = true');

    // boolean defaults to true in sample data, but show_details condition
    // checks for true, so we need to override to false to hide the group
    const data = project.generateSampleData({ show_details: false });

    expect(data).not.toHaveProperty('details.name');
    expect(data).not.toHaveProperty('details.email');
  });

  it('generates nested arrays for repeatable groups', () => {
    const project = createProject();
    project.addGroup('line_items', 'Line Items');
    project.addField('line_items.description', 'Description', 'string');
    project.addField('line_items.amount', 'Amount', 'decimal');
    project.makeRepeatable('line_items');

    const data = project.generateSampleData();

    // Should produce a nested array, not flat dot-path keys
    expect(data).not.toHaveProperty('line_items.description');
    expect(data).not.toHaveProperty('line_items.amount');
    expect(Array.isArray(data.line_items)).toBe(true);
    const instances = data.line_items as Record<string, unknown>[];
    expect(instances.length).toBeGreaterThanOrEqual(1);
    expect(instances.length).toBeLessThanOrEqual(2);
    expect(instances[0]).toHaveProperty('description');
    expect(instances[0]).toHaveProperty('amount');
    expect(typeof instances[0].description).toBe('string');
    expect(typeof instances[0].amount).toBe('number');
  });

  it('generates nested arrays with 2 instances for repeatable groups', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.addField('items.name', 'Name', 'string');
    project.makeRepeatable('items');

    const data = project.generateSampleData();

    const instances = data.items as Record<string, unknown>[];
    expect(instances.length).toBe(2);
  });

  it('keeps unconditional fields when other fields are hidden', () => {
    const project = createProject();
    project.addField('always_visible', 'Always', 'text');
    project.addField('toggle', 'Toggle', 'boolean');
    project.addField('conditional', 'Conditional', 'text');
    project.showWhen('conditional', '$toggle = true');

    // toggle defaults to true in sample data, conditional should be visible
    const data = project.generateSampleData();

    expect(data).toHaveProperty('always_visible');
    expect(data).toHaveProperty('conditional');
  });
});

describe('normalizeDefinition', () => {
  it('returns a deep clone of the definition', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');

    const normalized = project.normalizeDefinition();

    // It should be a plain object, not the same reference
    expect(normalized).not.toBe(project.definition);
    expect(normalized).toHaveProperty('items');
  });

  it('strips null values', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');

    const normalized = project.normalizeDefinition();

    // Walk the object checking no null values
    const hasNull = JSON.stringify(normalized).includes(':null');
    expect(hasNull).toBe(false);
  });

  it('strips empty arrays', () => {
    const project = createProject();
    // Fresh project may have empty arrays for binds/shapes/variables

    const normalized = project.normalizeDefinition();
    const text = JSON.stringify(normalized);

    // Should not have empty arrays like "[]"
    expect(text).not.toMatch(/"[^"]+"\s*:\s*\[\]/);
  });

  it('preserves non-empty arrays and non-null values', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');
    project.addField('q2', 'Q2', 'integer');

    const normalized = project.normalizeDefinition();

    // Items array should be preserved because it's non-empty
    expect((normalized as any).items.length).toBeGreaterThanOrEqual(2);
  });

  it('strips undefined keys', () => {
    const project = createProject();
    project.addField('q1', 'Q1', 'text');

    const normalized = project.normalizeDefinition();

    // The output should be JSON-serializable (no undefined)
    const serialized = JSON.stringify(normalized);
    const reparsed = JSON.parse(serialized);
    expect(reparsed).toEqual(normalized);
  });
});
