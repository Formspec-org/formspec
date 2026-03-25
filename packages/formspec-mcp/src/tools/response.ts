/** @filedesc MCP tool for response testing: set_test_response, get_test_response, clear_test_responses, validate_response. */
import type { ProjectRegistry } from '../registry.js';
import { successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError, validateResponse } from 'formspec-studio-core';

type ResponseAction = 'set_test_response' | 'get_test_response' | 'clear_test_responses' | 'validate_response';

interface ResponseParams {
  action: ResponseAction;
  // For set_test_response / get_test_response
  field?: string;
  value?: unknown;
  // For validate_response
  response?: Record<string, unknown>;
}

/**
 * Per-project test response storage.
 * Keyed by projectId since the registry doesn't carry test data.
 */
const testResponses = new Map<string, Record<string, unknown>>();

export function handleResponse(
  registry: ProjectRegistry,
  projectId: string,
  params: ResponseParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'set_test_response': {
        if (!testResponses.has(projectId)) {
          testResponses.set(projectId, {});
        }
        const data = testResponses.get(projectId)!;
        data[params.field!] = params.value;

        return successResponse({
          field: params.field,
          value: params.value,
          summary: `Set test response for '${params.field}'`,
        });
      }

      case 'get_test_response': {
        const data = testResponses.get(projectId) ?? {};
        if (params.field) {
          return successResponse({
            field: params.field,
            value: data[params.field] ?? null,
          });
        }
        return successResponse({ response: data });
      }

      case 'clear_test_responses': {
        testResponses.delete(projectId);
        return successResponse({
          summary: 'Cleared all test responses',
        });
      }

      case 'validate_response': {
        const response = params.response ?? testResponses.get(projectId) ?? {};
        const report = validateResponse(project, response);
        return successResponse(report);
      }
    }
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

/** Clear test responses for a project (call on close). Exported for testing. */
export function clearTestResponsesForProject(projectId: string): void {
  testResponses.delete(projectId);
}
