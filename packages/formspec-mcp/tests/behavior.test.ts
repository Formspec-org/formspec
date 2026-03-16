import { describe, it, expect } from 'vitest';
import { registryWithProject, registryInBootstrap } from './helpers.js';
import { handleField } from '../src/tools/structure.js';
import {
  handleShowWhen,
  handleReadonlyWhen,
  handleRequire,
  handleCalculate,
  handleAddRule,
} from '../src/tools/behavior.js';
import { handleBranch } from '../src/tools/flow.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── handleShowWhen ───────────────────────────────────────────────

describe('handleShowWhen', () => {
  it('sets visibility condition on a field', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'age', 'Age', 'integer');
    handleField(registry, projectId, 'details', 'Details', 'text');

    const result = handleShowWhen(registry, projectId, 'details', '$age > 18');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('details');
  });

  it('returns WRONG_PHASE during bootstrap', () => {
    const { registry, projectId } = registryInBootstrap();
    const result = handleShowWhen(registry, projectId, 'q1', '$q2 = true');
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('WRONG_PHASE');
  });
});

// ── handleReadonlyWhen ───────────────────────────────────────────

describe('handleReadonlyWhen', () => {
  it('sets readonly condition on a field', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'status', 'Status', 'choice', {
      choices: [
        { value: 'locked', label: 'Locked' },
        { value: 'open', label: 'Open' },
      ],
    });
    handleField(registry, projectId, 'notes', 'Notes', 'text');

    const result = handleReadonlyWhen(registry, projectId, 'notes', "$status = 'locked'");
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('notes');
  });
});

// ── handleRequire ────────────────────────────────────────────────

describe('handleRequire', () => {
  it('marks a field as unconditionally required', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'name', 'Name', 'text');

    const result = handleRequire(registry, projectId, 'name');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('name');
  });

  it('marks a field as conditionally required', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'consent', 'Consent', 'boolean');
    handleField(registry, projectId, 'signature', 'Signature', 'text');

    const result = handleRequire(registry, projectId, 'signature', '$consent = true');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('signature');
  });
});

// ── handleCalculate ──────────────────────────────────────────────

describe('handleCalculate', () => {
  it('sets a calculated expression on a field', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'price', 'Price', 'decimal');
    handleField(registry, projectId, 'qty', 'Qty', 'integer');
    handleField(registry, projectId, 'total', 'Total', 'decimal');

    const result = handleCalculate(registry, projectId, 'total', '$price * $qty');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('total');
  });

  it('succeeds even for paths without a field (creates a bind)', () => {
    const { registry, projectId } = registryWithProject();
    const result = handleCalculate(registry, projectId, 'nonexistent', '1 + 1');
    const data = parseResult(result);

    // calculate creates a bind regardless of whether the field exists
    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths).toContain('nonexistent');
  });
});

// ── handleAddRule ────────────────────────────────────────────────

describe('handleAddRule', () => {
  it('adds a validation rule to a field', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'age', 'Age', 'integer');

    const result = handleAddRule(registry, projectId, 'age', '$age >= 0', 'Age must be non-negative');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    // addValidation returns the shape ID in affectedPaths (e.g. "shape_1")
    expect(data.affectedPaths.length).toBeGreaterThan(0);
    expect(data.createdId).toBeTruthy();
  });

  it('adds a validation rule with options', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'email', 'Email', 'email');

    const result = handleAddRule(
      registry, projectId, 'email',
      "contains($email, '@')",
      'Must contain @ symbol',
      { severity: 'warning', timing: 'continuous' },
    );
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
    expect(data.summary).toContain('email');
  });
});

// ── handleBranch ─────────────────────────────────────────────────

describe('handleBranch', () => {
  it('branches with multiple arms', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'color', 'Favorite Color', 'choice', {
      choices: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
      ],
    });
    handleField(registry, projectId, 'red_details', 'Red Details', 'text');
    handleField(registry, projectId, 'blue_details', 'Blue Details', 'text');

    const result = handleBranch(registry, projectId, 'color', [
      { when: 'red', show: 'red_details' },
      { when: 'blue', show: 'blue_details' },
    ]);
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
  });

  it('branches with otherwise', () => {
    const { registry, projectId } = registryWithProject();
    handleField(registry, projectId, 'role', 'Role', 'choice', {
      choices: [
        { value: 'admin', label: 'Admin' },
        { value: 'user', label: 'User' },
      ],
    });
    handleField(registry, projectId, 'admin_panel', 'Admin Panel', 'text');
    handleField(registry, projectId, 'user_panel', 'User Panel', 'text');

    const result = handleBranch(
      registry, projectId, 'role',
      [{ when: 'admin', show: 'admin_panel' }],
      'user_panel',
    );
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.affectedPaths.length).toBeGreaterThan(0);
  });
});
