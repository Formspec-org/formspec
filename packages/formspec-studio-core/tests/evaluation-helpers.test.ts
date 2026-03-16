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
});
