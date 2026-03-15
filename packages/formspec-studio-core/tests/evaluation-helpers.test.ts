import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project-wrapper.js';
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
