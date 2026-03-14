/**
 * Unit tests for diagnosticsToInquestIssues and mergeIssueSets.
 *
 * diagnosticsToInquestIssues converts the structured Diagnostics object
 * (structural, expressions, extensions, consistency) into a flat array
 * of InquestIssue objects suitable for the session.
 *
 * mergeIssueSets deduplicates issues across multiple sources by ID,
 * with later sets overwriting earlier ones.
 */

import { describe, expect, it } from 'vitest';
import { diagnosticsToInquestIssues, mergeIssueSets } from '../../src/shared/authoring/diagnostics-issues';
import type { Diagnostic, Diagnostics } from 'formspec-studio-core';
import type { InquestIssue } from '../../src/shared/contracts/inquest';

/* ── Factories ──────────────────────────────────── */

function makeDiagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    artifact: 'definition',
    path: 'items.0',
    severity: 'error',
    code: 'MISSING_FIELD',
    message: 'Required field is missing',
    ...overrides,
  };
}

function makeEmptyDiagnostics(): Diagnostics {
  return {
    structural: [],
    expressions: [],
    extensions: [],
    consistency: [],
    counts: { error: 0, warning: 0, info: 0 },
  };
}

function makeIssue(overrides: Partial<InquestIssue> = {}): InquestIssue {
  return {
    id: 'test-issue-1',
    title: 'Test Issue',
    message: 'Something happened',
    severity: 'warning',
    source: 'analysis',
    status: 'open',
    blocking: false,
    ...overrides,
  };
}

/* ── diagnosticsToInquestIssues ───────────────── */

describe('diagnosticsToInquestIssues', () => {
  it('returns empty array when all diagnostic categories are empty', () => {
    const result = diagnosticsToInquestIssues(makeEmptyDiagnostics());
    expect(result).toEqual([]);
  });

  it('converts structural diagnostics into InquestIssues', () => {
    const diag = makeEmptyDiagnostics();
    diag.structural = [makeDiagnostic({ code: 'BAD_SCHEMA', path: 'items.0.key' })];

    const result = diagnosticsToInquestIssues(diag);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('diagnostic');
    expect(result[0].fieldPath).toBe('items.0.key');
  });

  it('converts expression diagnostics into InquestIssues', () => {
    const diag = makeEmptyDiagnostics();
    diag.expressions = [makeDiagnostic({ code: 'FEL_PARSE_ERROR', severity: 'error' })];

    const result = diagnosticsToInquestIssues(diag);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('error');
    expect(result[0].blocking).toBe(true);
  });

  it('converts extension diagnostics into InquestIssues', () => {
    const diag = makeEmptyDiagnostics();
    diag.extensions = [makeDiagnostic({ code: 'UNRESOLVED_EXTENSION', severity: 'warning' })];

    const result = diagnosticsToInquestIssues(diag);
    expect(result).toHaveLength(1);
    expect(result[0].blocking).toBe(false);
  });

  it('converts consistency diagnostics into InquestIssues', () => {
    const diag = makeEmptyDiagnostics();
    diag.consistency = [makeDiagnostic({ code: 'ORPHAN_REF', severity: 'info' })];

    const result = diagnosticsToInquestIssues(diag);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('info');
    expect(result[0].blocking).toBe(false);
  });

  it('aggregates diagnostics from all four categories', () => {
    const diag: Diagnostics = {
      structural: [makeDiagnostic({ code: 'S1' })],
      expressions: [makeDiagnostic({ code: 'E1' }), makeDiagnostic({ code: 'E2' })],
      extensions: [makeDiagnostic({ code: 'X1' })],
      consistency: [],
      counts: { error: 4, warning: 0, info: 0 },
    };

    const result = diagnosticsToInquestIssues(diag);
    expect(result).toHaveLength(4);
  });

  it('replaces underscores in code with spaces for the title', () => {
    const diag = makeEmptyDiagnostics();
    diag.structural = [makeDiagnostic({ code: 'MISSING_REQUIRED_FIELD' })];

    const result = diagnosticsToInquestIssues(diag);
    expect(result[0].title).toBe('MISSING REQUIRED FIELD');
  });

  it('generates deterministic IDs from artifact, code, path, and index', () => {
    const diag = makeEmptyDiagnostics();
    diag.structural = [
      makeDiagnostic({ artifact: 'definition', code: 'BAD', path: 'a.b' }),
    ];

    const result = diagnosticsToInquestIssues(diag);
    expect(result[0].id).toBe('diagnostic:definition:BAD:a.b:0');
  });

  it('uses index to differentiate duplicate diagnostics with same artifact/code/path', () => {
    const diag = makeEmptyDiagnostics();
    diag.structural = [
      makeDiagnostic({ artifact: 'definition', code: 'BAD', path: 'a.b' }),
      makeDiagnostic({ artifact: 'definition', code: 'BAD', path: 'a.b' }),
    ];

    // The two diagnostics get indices 0 and 1 within the flat array
    const result = diagnosticsToInquestIssues(diag);
    expect(result[0].id).not.toBe(result[1].id);
  });

  it('sets status to open for all converted diagnostics', () => {
    const diag = makeEmptyDiagnostics();
    diag.expressions = [
      makeDiagnostic({ severity: 'error' }),
      makeDiagnostic({ severity: 'warning' }),
      makeDiagnostic({ severity: 'info' }),
    ];

    const result = diagnosticsToInquestIssues(diag);
    for (const issue of result) {
      expect(issue.status).toBe('open');
    }
  });

  it('maps error severity to blocking=true, non-error to blocking=false', () => {
    const diag = makeEmptyDiagnostics();
    diag.structural = [
      makeDiagnostic({ severity: 'error' }),
      makeDiagnostic({ severity: 'warning' }),
      makeDiagnostic({ severity: 'info' }),
    ];

    const result = diagnosticsToInquestIssues(diag);
    expect(result[0].blocking).toBe(true);
    expect(result[1].blocking).toBe(false);
    expect(result[2].blocking).toBe(false);
  });
});

/* ── mergeIssueSets ───────────────────────────── */

describe('mergeIssueSets', () => {
  it('returns empty array when no issue sets are provided', () => {
    expect(mergeIssueSets()).toEqual([]);
  });

  it('returns empty array when all issue sets are empty', () => {
    expect(mergeIssueSets([], [], [])).toEqual([]);
  });

  it('returns all issues from a single set unchanged', () => {
    const issues = [makeIssue({ id: 'a' }), makeIssue({ id: 'b' })];
    const result = mergeIssueSets(issues);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('merges issues from multiple sets', () => {
    const set1 = [makeIssue({ id: 'a', source: 'analysis' })];
    const set2 = [makeIssue({ id: 'b', source: 'proposal' })];
    const set3 = [makeIssue({ id: 'c', source: 'diagnostic' })];

    const result = mergeIssueSets(set1, set2, set3);
    expect(result).toHaveLength(3);
  });

  it('deduplicates by ID, keeping the last occurrence', () => {
    const set1 = [makeIssue({ id: 'dup', severity: 'warning', message: 'original' })];
    const set2 = [makeIssue({ id: 'dup', severity: 'error', message: 'updated' })];

    const result = mergeIssueSets(set1, set2);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('error');
    expect(result[0].message).toBe('updated');
  });

  it('preserves order of first appearance when no duplicates exist', () => {
    const set1 = [makeIssue({ id: 'a' }), makeIssue({ id: 'b' })];
    const set2 = [makeIssue({ id: 'c' })];

    const result = mergeIssueSets(set1, set2);
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles duplicate IDs across more than two sets', () => {
    const set1 = [makeIssue({ id: 'x', message: 'v1' })];
    const set2 = [makeIssue({ id: 'x', message: 'v2' })];
    const set3 = [makeIssue({ id: 'x', message: 'v3' })];

    const result = mergeIssueSets(set1, set2, set3);
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('v3');
  });

  it('handles a mix of unique and duplicate IDs', () => {
    const set1 = [makeIssue({ id: 'a' }), makeIssue({ id: 'shared' })];
    const set2 = [makeIssue({ id: 'b' }), makeIssue({ id: 'shared', message: 'overwritten' })];

    const result = mergeIssueSets(set1, set2);
    expect(result).toHaveLength(3);
    const shared = result.find((i) => i.id === 'shared');
    expect(shared!.message).toBe('overwritten');
  });
});
