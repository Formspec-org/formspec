/**
 * Batch processing utility for MCP tools.
 *
 * Processes an array of items sequentially, collecting per-item results.
 * Continues on failure — partial success is reported, no rollback.
 */

import { HelperError, type HelperResult } from 'formspec-studio-core';

/** A single item in a batch — shape varies per tool */
export type BatchItem = Record<string, unknown>;

/** Per-item result */
export interface BatchItemResult {
  index: number;
  success: boolean;
  summary?: string;
  error?: {
    code: string;
    message: string;
    detail?: Record<string, unknown>;
  };
}

/** Aggregate batch response */
export interface BatchResult {
  results: BatchItemResult[];
  succeeded: number;
  failed: number;
}

/**
 * Execute a batch of items, calling `fn` for each.
 * Catches errors per-item so one failure doesn't abort the rest.
 */
export function executeBatch(
  items: BatchItem[],
  fn: (item: BatchItem, index: number) => HelperResult,
): BatchResult {
  const results: BatchItemResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    try {
      const result = fn(items[i], i);
      results.push({ index: i, success: true, summary: result.summary });
      succeeded++;
    } catch (err) {
      failed++;
      if (err instanceof HelperError) {
        const entry: BatchItemResult = {
          index: i,
          success: false,
          error: { code: err.code, message: err.message },
        };
        if (err.detail) {
          entry.error!.detail = err.detail as Record<string, unknown>;
        }
        results.push(entry);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          index: i,
          success: false,
          error: { code: 'COMMAND_FAILED', message },
        });
      }
    }
  }

  return { results, succeeded, failed };
}
