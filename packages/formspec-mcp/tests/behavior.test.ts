import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleField } from '../src/tools/structure.js';
import { handleBehavior } from '../src/tools/behavior.js';
import { handleFlow } from '../src/tools/flow.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── show_when ───────────────────────────────────────────────────

describe('handleBehavior — show_when', () => {
  it('sets visibility condition on a field', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'age', label: 'Age', type: 'integer' });
    handleField(registry, projectId, { path: 'details', label: 'Details', type: 'text' });

    const result = handleBehavior(registry, projectId, {
      action: 'show_when', target: 'details', condition: '$age > 18',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('details');
  });

  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handleBehavior(registry, projectId, {
      action: 'show_when', target: 'q1', condition: '$q2 = true',
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});

// ── readonly_when ───────────────────────────────────────────────

describe('handleBehavior — readonly_when', () => {
  it('sets readonly condition on a field', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, {
      path: 'status', label: 'Status', type: 'choice',
      props: {
        choices: [
          { value: 'locked', label: 'Locked' },
          { value: 'open', label: 'Open' },
        ],
      },
    });
    handleField(registry, projectId, { path: 'notes', label: 'Notes', type: 'text' });

    const result = handleBehavior(registry, projectId, {
      action: 'readonly_when', target: 'notes', condition: "$status = 'locked'",
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('notes');
  });
});

// ── require ─────────────────────────────────────────────────────

describe('handleBehavior — require', () => {
  it('marks a field as unconditionally required', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });

    const result = handleBehavior(registry, projectId, {
      action: 'require', target: 'name',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('name');
  });

  it('marks a field as conditionally required', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'consent', label: 'Consent', type: 'boolean' });
    handleField(registry, projectId, { path: 'signature', label: 'Signature', type: 'text' });

    const result = handleBehavior(registry, projectId, {
      action: 'require', target: 'signature', condition: '$consent = true',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('signature');
  });
});

// ── calculate ───────────────────────────────────────────────────

describe('handleBehavior — calculate', () => {
  it('sets a calculated expression on a field', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'price', label: 'Price', type: 'decimal' });
    handleField(registry, projectId, { path: 'qty', label: 'Qty', type: 'integer' });
    handleField(registry, projectId, { path: 'total', label: 'Total', type: 'decimal' });

    const result = handleBehavior(registry, projectId, {
      action: 'calculate', target: 'total', expression: '$price * $qty',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('total');
  });

  it('succeeds even for paths without a field (creates a bind)', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleBehavior(registry, projectId, {
      action: 'calculate', target: 'nonexistent', expression: '1 + 1',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('nonexistent');
  });
});

// ── add_rule ────────────────────────────────────────────────────

describe('handleBehavior — add_rule', () => {
  it('adds a validation rule to a field', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'age', label: 'Age', type: 'integer' });

    const result = handleBehavior(registry, projectId, {
      action: 'add_rule', target: 'age', rule: '$age >= 0', message: 'Age must be non-negative',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
    expect(data.createdId).toBeTruthy();
  });

  it('adds a validation rule with options', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'email', label: 'Email', type: 'email' });

    const result = handleBehavior(registry, projectId, {
      action: 'add_rule', target: 'email',
      rule: "contains($email, '@')", message: 'Must contain @ symbol',
      options: { severity: 'warning', timing: 'continuous' },
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
    expect(data.summary).toContain('email');
  });
});

// ── batch mode ──────────────────────────────────────────────────

describe('handleBehavior — batch', () => {
  it('applies multiple behaviors in a single call', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, { path: 'name', label: 'Name', type: 'text' });
    handleField(registry, projectId, { path: 'age', label: 'Age', type: 'integer' });

    const result = handleBehavior(registry, projectId, {
      action: 'require', target: '',
      items: [
        { action: 'require', target: 'name' },
        { action: 'require', target: 'age' },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.succeeded).toBe(2);
    expect(data.failed).toBe(0);
  });

  it('returns WRONG_PHASE for batch during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handleBehavior(registry, projectId, {
      action: 'require', target: '',
      items: [{ action: 'require', target: 'q1' }],
    });
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});

// ── handleFlow — branch ─────────────────────────────────────────

describe('handleFlow — branch', () => {
  it('branches with multiple arms', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, {
      path: 'color', label: 'Favorite Color', type: 'choice',
      props: {
        choices: [
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' },
        ],
      },
    });
    handleField(registry, projectId, { path: 'red_details', label: 'Red Details', type: 'text' });
    handleField(registry, projectId, { path: 'blue_details', label: 'Blue Details', type: 'text' });

    const result = handleFlow(registry, projectId, {
      action: 'branch', on: 'color',
      paths: [
        { when: 'red', show: 'red_details' },
        { when: 'blue', show: 'blue_details' },
      ],
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
  });

  it('branches with otherwise', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, {
      path: 'role', label: 'Role', type: 'choice',
      props: {
        choices: [
          { value: 'admin', label: 'Admin' },
          { value: 'user', label: 'User' },
        ],
      },
    });
    handleField(registry, projectId, { path: 'admin_panel', label: 'Admin Panel', type: 'text' });
    handleField(registry, projectId, { path: 'user_panel', label: 'User Panel', type: 'text' });

    const result = handleFlow(registry, projectId, {
      action: 'branch', on: 'role',
      paths: [{ when: 'admin', show: 'admin_panel' }],
      otherwise: 'user_panel',
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
  });
});

// ── handleFlow — set_mode ───────────────────────────────────────

describe('handleFlow — set_mode', () => {
  it('sets wizard flow mode', () => {
    const { registry, projectId } = registryWithProject();

    const result = handleFlow(registry, projectId, {
      action: 'set_mode', mode: 'wizard',
      props: { showProgress: true },
    });
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThanOrEqual(0);
  });
});
