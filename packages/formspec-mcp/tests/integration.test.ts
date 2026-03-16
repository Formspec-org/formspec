/**
 * Integration test: end-to-end workflow exercising the consolidated tool handlers.
 *
 * Simulates a realistic form-building session:
 * guide → create → draft → load → batch fields → update → behavior → describe → search → preview
 */
import { describe, it, expect } from 'vitest';
import { ProjectRegistry } from '../src/registry.js';
import { initSchemas } from '../src/schemas.js';
import { resolve } from 'node:path';

import { handleGuide } from '../src/tools/guide.js';
import { handleDraft, handleLoad } from '../src/tools/bootstrap.js';
import { handleCreate } from '../src/tools/lifecycle.js';
import { handleField, handleContent, handleGroup, handleUpdate, handleEdit, handleSubmitButton } from '../src/tools/structure.js';
import { handleBehavior } from '../src/tools/behavior.js';
import { handleFlow } from '../src/tools/flow.js';
import { handleData } from '../src/tools/data.js';
import { handleDescribe, handleSearch, handlePreview, handleTrace } from '../src/tools/query.js';
import { handleFel } from '../src/tools/fel.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// Init schemas once for bootstrap tests
const schemasDir = resolve(process.cwd(), '../../schemas');
initSchemas(schemasDir);

describe('end-to-end: grant application form', () => {
  const registry = new ProjectRegistry();
  let projectId: string;

  it('step 1: guide returns questionnaire for new form', () => {
    const result = handleGuide(registry, 'new', undefined, 'grant application form');
    const data = parseResult(result);

    expect(data).toHaveProperty('workflow');
    expect(data).toHaveProperty('questionnaire');
    expect(data).toHaveProperty('output_instructions');
    expect(data.questionnaire.sections.length).toBeGreaterThan(0);
  });

  it('step 2: create project', () => {
    const result = handleCreate(registry);
    const data = parseResult(result);

    expect(data.project_id).toBeTruthy();
    expect(data.phase).toBe('bootstrap');
    projectId = data.project_id;
  });

  it('step 3: draft definition', () => {
    const result = handleDraft(registry, projectId, 'definition', {
      $formspec: '1.0',
      url: 'urn:test:grant-app',
      version: '1.0.0',
      status: 'draft',
      title: 'Grant Application',
      items: [
        { key: 'applicant_name', type: 'field', label: 'Applicant Name', dataType: 'string' },
        { key: 'project_title', type: 'field', label: 'Project Title', dataType: 'string' },
        { key: 'amount', type: 'field', label: 'Requested Amount', dataType: 'decimal' },
      ],
    });
    const data = parseResult(result);
    expect(result.isError).toBeUndefined();
    expect(data.valid).toBe(true);
  });

  it('step 4: load transitions to authoring', () => {
    const result = handleLoad(registry, projectId);
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.phase).toBe('authoring');
  });

  it('step 5: batch add more fields', () => {
    const result = handleField(registry, projectId, {
      items: [
        { path: 'org_name', label: 'Organization', type: 'text' },
        { path: 'email', label: 'Contact Email', type: 'email' },
        { path: 'category', label: 'Grant Category', type: 'choice',
          props: {
            choices: [
              { value: 'research', label: 'Research' },
              { value: 'education', label: 'Education' },
              { value: 'community', label: 'Community' },
            ],
          },
        },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.succeeded).toBe(3);
    expect(data.failed).toBe(0);
  });

  it('step 6: add content elements', () => {
    const result = handleContent(registry, projectId, {
      path: 'intro',
      body: 'Welcome to the Grant Application',
      kind: 'heading',
    });
    expect(result.isError).toBeUndefined();
  });

  it('step 7: add group with repeat', () => {
    const result = handleGroup(registry, projectId, {
      path: 'budget_items',
      label: 'Budget Line Items',
      props: { repeat: { min: 1, max: 20 } },
    });
    expect(result.isError).toBeUndefined();
  });

  it('step 8: add fields inside the group', () => {
    const result = handleField(registry, projectId, {
      items: [
        { path: 'budget_items.description', label: 'Item Description', type: 'text' },
        { path: 'budget_items.cost', label: 'Cost', type: 'decimal' },
      ],
    });
    const data = parseResult(result);
    expect(data.succeeded).toBe(2);
  });

  it('step 9: update a field label', () => {
    const result = handleUpdate(registry, projectId, 'item', {
      path: 'applicant_name',
      changes: { label: 'Full Legal Name' },
    });
    expect(result.isError).toBeUndefined();
  });

  it('step 10: update form metadata', () => {
    const result = handleUpdate(registry, projectId, 'metadata', {
      changes: { title: 'Community Grant Application 2026', description: 'Application for community development grants' },
    });
    expect(result.isError).toBeUndefined();
  });

  it('step 11: set behaviors (batch)', () => {
    const result = handleBehavior(registry, projectId, {
      action: 'require', target: '',
      items: [
        { action: 'require', target: 'applicant_name' },
        { action: 'require', target: 'email' },
        { action: 'require', target: 'amount' },
        { action: 'require', target: 'category' },
      ],
    });
    const data = parseResult(result);

    expect(data.succeeded).toBe(4);
    expect(data.failed).toBe(0);
  });

  it('step 12: add validation rule', () => {
    const result = handleBehavior(registry, projectId, {
      action: 'add_rule',
      target: 'amount',
      rule: '$amount > 0',
      message: 'Requested amount must be greater than zero',
    });
    expect(result.isError).toBeUndefined();
  });

  it('step 13: add conditional visibility', () => {
    const result = handleBehavior(registry, projectId, {
      action: 'show_when',
      target: 'org_name',
      condition: '$category != null',
    });
    expect(result.isError).toBeUndefined();
  });

  it('step 14: define reusable choices', () => {
    const result = handleData(registry, projectId, {
      resource: 'choices',
      action: 'add',
      name: 'priority_levels',
      options: [
        { value: 'high', label: 'High Priority' },
        { value: 'medium', label: 'Medium Priority' },
        { value: 'low', label: 'Low Priority' },
      ],
    });
    expect(result.isError).toBeUndefined();
  });

  it('step 15: add submit button', () => {
    const result = handleSubmitButton(registry, projectId, 'Submit Application');
    expect(result.isError).toBeUndefined();
  });

  it('step 16: describe form structure', () => {
    const result = handleDescribe(registry, projectId, 'structure');
    const data = parseResult(result);

    expect(data).toHaveProperty('statistics');
    expect(data).toHaveProperty('fieldPaths');
    expect(data.fieldPaths).toContain('applicant_name');
    expect(data.fieldPaths).toContain('email');
    expect(data.fieldPaths).toContain('category');
  });

  it('step 17: describe a specific item', () => {
    const result = handleDescribe(registry, projectId, 'structure', 'amount');
    const data = parseResult(result);

    expect(data.item).toBeTruthy();
    expect(data.item.label).toBe('Requested Amount');
  });

  it('step 18: audit the form', () => {
    const result = handleDescribe(registry, projectId, 'audit');
    const data = parseResult(result);

    expect(data).toHaveProperty('counts');
    expect(typeof data.counts.error).toBe('number');
  });

  it('step 19: search for fields', () => {
    const result = handleSearch(registry, projectId, { type: 'field' });
    const data = parseResult(result);

    expect(data.items.length).toBeGreaterThan(3);
  });

  it('step 20: trace dependencies', () => {
    const result = handleTrace(registry, projectId, 'trace', { expression_or_field: 'amount' });
    const data = parseResult(result);

    expect(data.type).toBe('field');
    expect(data).toHaveProperty('dependents');
  });

  it('step 21: check FEL expression', () => {
    const result = handleFel(registry, projectId, {
      action: 'check',
      expression: '$amount > 0',
    });
    const data = parseResult(result);

    expect(data.valid).toBe(true);
    expect(data.references).toContain('amount');
  });

  it('step 22: preview form', () => {
    const result = handlePreview(registry, projectId, 'preview', {});
    const data = parseResult(result);

    expect(data).toHaveProperty('visibleFields');
    expect(data).toHaveProperty('currentValues');
    expect(data).toHaveProperty('requiredFields');
  });

  it('step 23: preview with scenario data', () => {
    const result = handlePreview(registry, projectId, 'preview', {
      scenario: { applicant_name: 'Jane Doe', amount: 50000 },
    });
    const data = parseResult(result);

    expect(data.currentValues.applicant_name).toBe('Jane Doe');
    expect(data.currentValues.amount).toBe(50000);
  });

  it('step 24: validate a response', () => {
    const result = handlePreview(registry, projectId, 'validate', {
      response: { applicant_name: 'Jane Doe', amount: 50000, email: 'jane@example.com', category: 'research' },
    });
    const data = parseResult(result);

    expect(data).toHaveProperty('results');
  });

  it('step 25: copy a field', () => {
    const result = handleEdit(registry, projectId, 'copy', { path: 'email' });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
  });

  it('step 26: remove the copy', () => {
    // The copy creates email_copy or similar
    const desc = parseResult(handleDescribe(registry, projectId, 'structure'));
    const copyField = desc.fieldPaths.find((p: string) => p.startsWith('email') && p !== 'email');

    if (copyField) {
      const result = handleEdit(registry, projectId, 'remove', { path: copyField });
      expect(result.isError).toBeUndefined();
    }
  });

  it('step 27: set flow mode', () => {
    const result = handleFlow(registry, projectId, {
      action: 'set_mode',
      mode: 'single',
    });
    expect(result.isError).toBeUndefined();
  });
});
