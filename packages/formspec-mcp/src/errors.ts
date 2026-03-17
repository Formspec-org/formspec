/** @filedesc MCP response helpers: error/success formatting and helper-call wrappers. */
import { HelperError, type HelperResult } from 'formspec-studio-core';
import { executeBatch, type BatchItem, type BatchResult } from './batch.js';

export type ToolError = {
  code: string;
  message: string;
  detail?: Record<string, unknown>;
} & Record<string, unknown>;

export function formatToolError(code: string, message: string, detail?: Record<string, unknown>): ToolError {
  const error: ToolError = { code, message };
  if (detail) error.detail = detail;
  return error;
}

/** MCP error response shape with structuredContent */
export function errorResponse(error: ToolError) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: JSON.stringify(error) }],
    structuredContent: error as Record<string, unknown>,
  };
}

/** MCP success response shape */
export function successResponse(result: unknown) {
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  const structuredContent = (typeof result === 'object' && result !== null && !Array.isArray(result))
    ? (result as Record<string, unknown>)
    : undefined;

  return {
    content: [{ type: 'text' as const, text }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

/**
 * Wraps a Project helper call with uniform error handling.
 * Catches HelperError → maps to ToolError wire format.
 * Catches any other Error → maps to COMMAND_FAILED.
 */
export function wrapHelperCall(
  fn: () => HelperResult,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  try {
    const result = fn();
    return successResponse(result);
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message, {
      handlerMessage: message,
    }));
  }
}

/**
 * Wraps a batch operation into an MCP response.
 * Uses successResponse when all succeed, marks isError when ALL fail.
 * Partial success returns a normal response with the failure details inside.
 */
export function wrapBatchCall(
  items: BatchItem[],
  fn: (item: BatchItem, index: number) => HelperResult,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  const result = executeBatch(items, fn);
  if (result.failed > 0 && result.succeeded === 0) {
    return errorResponse(formatToolError('BATCH_ALL_FAILED', `All ${result.failed} items failed`, {
      results: result.results as unknown as Record<string, unknown>,
    }));
  }
  return successResponse(result);
}
