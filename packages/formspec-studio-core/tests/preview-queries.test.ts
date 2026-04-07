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

    expect(data.name).toBe('Sample text');
    expect(data.bio).toBe('Sample paragraph text');
    expect(data.age).toBe(42);
    expect(data.score).toBe(3.14);
    expect(data.active).toBe(true);
    expect(data.dob).toBe('2024-01-15');
  });

  it('generates sample values for time-related types', () => {
    const project = createProject();
    project.addField('t', 'Time', 'time');
    project.addField('dt', 'DateTime', 'dateTime');

    const data = project.generateSampleData();

    expect(data.t).toBe('09:00:00');
    expect(data.dt).toBe('2024-01-15T09:00:00Z');
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

    // Group fields should use their full path
    expect(data['contact.email']).toBe('Sample text');
    expect(data['contact.phone']).toBe('Sample text');
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
    expect(data.age).toBe(42); // non-overridden field keeps default
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
