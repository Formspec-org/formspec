import { describe, it, expect } from 'vitest';
import { executeBatch, type BatchItem, type BatchResult } from '../src/batch.js';
import { wrapBatchCall } from '../src/errors.js';
import { HelperError, type HelperResult } from 'formspec-studio-core';

/** Fake HelperResult for testing */
function fakeResult(path: string): HelperResult {
  return {
    summary: `Added ${path}`,
    action: { helper: 'test', params: { path } },
    affectedPaths: [path],
  };
}

// ── executeBatch ─────────────────────────────────────────────────

describe('executeBatch', () => {
  it('processes all items and returns per-item results', () => {
    const items: BatchItem[] = [
      { path: 'name', label: 'Name' },
      { path: 'email', label: 'Email' },
    ];

    const result = executeBatch(items, (item) => fakeResult(item.path as string));

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toEqual({
      index: 0,
      success: true,
      summary: 'Added name',
    });
    expect(result.results[1]).toEqual({
      index: 1,
      success: true,
      summary: 'Added email',
    });
  });

  it('captures HelperError per item without aborting', () => {
    const items: BatchItem[] = [
      { path: 'name', label: 'Name' },
      { path: 'name', label: 'Duplicate' }, // will error
      { path: 'email', label: 'Email' },
    ];

    const result = executeBatch(items, (item, index) => {
      if (index === 1) throw new HelperError('DUPLICATE_KEY', 'Key already exists');
      return fakeResult(item.path as string);
    });

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.results).toHaveLength(3);

    // First item succeeds
    expect(result.results[0].success).toBe(true);

    // Second item fails with structured error
    expect(result.results[1].success).toBe(false);
    expect(result.results[1].error).toEqual({
      code: 'DUPLICATE_KEY',
      message: 'Key already exists',
    });

    // Third item still runs
    expect(result.results[2].success).toBe(true);
  });

  it('captures generic Error per item', () => {
    const items: BatchItem[] = [{ path: 'bad' }];

    const result = executeBatch(items, () => {
      throw new Error('Something unexpected');
    });

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0].error).toEqual({
      code: 'COMMAND_FAILED',
      message: 'Something unexpected',
    });
  });

  it('handles empty items array', () => {
    const result = executeBatch([], () => fakeResult('x'));

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results).toEqual([]);
  });

  it('includes detail from HelperError when present', () => {
    const items: BatchItem[] = [{ path: 'x' }];

    const result = executeBatch(items, () => {
      throw new HelperError('VALIDATION_ERROR', 'Bad value', { field: 'x', expected: 'string' });
    });

    expect(result.results[0].error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Bad value',
      detail: { field: 'x', expected: 'string' },
    });
  });

  it('processes single-item batch identically to multi', () => {
    const items: BatchItem[] = [{ path: 'name', label: 'Name' }];

    const result = executeBatch(items, (item) => fakeResult(item.path as string));

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(1);
  });
});

// ── wrapBatchCall (MCP integration) ─────────────────────────────

describe('wrapBatchCall', () => {
  it('returns success response when all items succeed', () => {
    const items: BatchItem[] = [{ path: 'a' }, { path: 'b' }];
    const response = wrapBatchCall(items, (item) => fakeResult(item.path as string));

    expect(response.isError).toBeUndefined();
    const data = JSON.parse(response.content[0].text);
    expect(data.succeeded).toBe(2);
    expect(data.failed).toBe(0);
  });

  it('returns success response for partial failure (some succeed)', () => {
    const items: BatchItem[] = [{ path: 'a' }, { path: 'b' }];
    const response = wrapBatchCall(items, (item, i) => {
      if (i === 1) throw new HelperError('DUPLICATE_KEY', 'exists');
      return fakeResult(item.path as string);
    });

    // Partial success is NOT an error response
    expect(response.isError).toBeUndefined();
    const data = JSON.parse(response.content[0].text);
    expect(data.succeeded).toBe(1);
    expect(data.failed).toBe(1);
  });

  it('returns error response when ALL items fail', () => {
    const items: BatchItem[] = [{ path: 'a' }, { path: 'b' }];
    const response = wrapBatchCall(items, () => {
      throw new HelperError('BAD', 'nope');
    });

    expect(response.isError).toBe(true);
    const data = JSON.parse(response.content[0].text);
    expect(data.code).toBe('BATCH_ALL_FAILED');
  });

  it('returns success response for empty batch', () => {
    const response = wrapBatchCall([], () => fakeResult('x'));

    expect(response.isError).toBeUndefined();
    const data = JSON.parse(response.content[0].text);
    expect(data.succeeded).toBe(0);
    expect(data.failed).toBe(0);
  });
});
