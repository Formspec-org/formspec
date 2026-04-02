import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project.js';
import { previewForm } from '../src/evaluation-helpers.js';

describe('addValidation template path normalization', () => {
  it('normalizes template path to wildcard when target traverses a repeatable group', () => {
    const project = createProject();
    project.addGroup('expenses', 'Expenses');
    project.addField('expenses.receipt_available', 'Receipt Available', 'boolean');
    project.makeRepeatable('expenses');

    project.addValidation('expenses.receipt_available', '$expenses.receipt_available = true', 'Receipt required');

    const shapes = project.definition.shapes ?? [];
    const shape = shapes[shapes.length - 1];
    expect(shape.target).toBe('expenses[*].receipt_available');
  });

  it('does not normalize path for non-repeatable group', () => {
    const project = createProject();
    project.addGroup('contact', 'Contact');
    project.addField('contact.email', 'Email', 'email');

    project.addValidation('contact.email', '$contact.email != ""', 'Required');

    const shapes = project.definition.shapes ?? [];
    const shape = shapes[shapes.length - 1];
    expect(shape.target).toBe('contact.email');
  });

  it('does not modify top-level field target', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');

    project.addValidation('name', '$name != ""', 'Required');

    const shapes = project.definition.shapes ?? [];
    const shape = shapes[shapes.length - 1];
    expect(shape.target).toBe('name');
  });

  it('does not modify explicit wildcard paths', () => {
    const project = createProject();
    project.addGroup('items', 'Items');
    project.addField('items.qty', 'Qty', 'integer');
    project.makeRepeatable('items');

    project.addValidation('items[*].qty', '$items[*].qty > 0', 'Must be positive');

    const shapes = project.definition.shapes ?? [];
    const shape = shapes[shapes.length - 1];
    expect(shape.target).toBe('items[*].qty');
  });

  it('normalizes nested repeatable groups', () => {
    const project = createProject();
    project.addGroup('sections', 'Sections');
    project.addGroup('sections.items', 'Items');
    project.addField('sections.items.amount', 'Amount', 'decimal');
    project.makeRepeatable('sections');
    project.makeRepeatable('sections.items');

    project.addValidation('sections.items.amount', '$sections.items.amount > 0', 'Positive');

    const shapes = project.definition.shapes ?? [];
    const shape = shapes[shapes.length - 1];
    expect(shape.target).toBe('sections[*].items[*].amount');
  });

  it('does not modify the global wildcard target', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');

    project.addValidation('*', '$a > 0', 'Positive');

    const shapes = project.definition.shapes ?? [];
    const shape = shapes[shapes.length - 1];
    expect(shape.target).toBe('*');
  });

  it('does not modify the form-level target #', () => {
    const project = createProject();
    project.addField('a', 'A', 'integer');

    project.addValidation('#', '$a > 0', 'Positive');

    const shapes = project.definition.shapes ?? [];
    const shape = shapes[shapes.length - 1];
    expect(shape.target).toBe('#');
  });

  it('shape on repeatable group field does not produce false positives in preview', () => {
    const project = createProject();
    project.addGroup('expenses', 'Expenses');
    project.addField('expenses.receipt', 'Has Receipt', 'boolean');
    project.makeRepeatable('expenses', { min: 1 });

    // Rule that should only fire when receipt is false
    project.addValidation('expenses.receipt', '$expenses.receipt = true', 'Receipt required');

    // Preview with no data -- repeatable group has 0 instances by default
    // so the shape should evaluate to zero results (no instances to check),
    // NOT produce a false positive on a ghost path
    const preview = previewForm(project);
    // No validation error should appear for the template path
    expect(preview.validationState['expenses.receipt']).toBeUndefined();
  });

  it('normalizes only the repeatable ancestor, not non-repeatable ones', () => {
    const project = createProject();
    project.addGroup('outer', 'Outer');
    project.makeRepeatable('outer');
    project.addGroup('outer.inner', 'Inner'); // not repeatable
    project.addField('outer.inner.val', 'Val', 'integer');

    project.addValidation('outer.inner.val', '$outer.inner.val > 0', 'Positive');

    const shapes = project.definition.shapes ?? [];
    const shape = shapes[shapes.length - 1];
    expect(shape.target).toBe('outer[*].inner.val');
  });
});
