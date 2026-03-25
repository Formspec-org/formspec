/** @filedesc MCP tool for locale management: strings, form-level strings, listing. */
import type { ProjectRegistry } from '../registry.js';
import { successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError } from 'formspec-studio-core';

type LocaleAction =
  | 'set_string'
  | 'remove_string'
  | 'list_strings'
  | 'set_form_string'
  | 'list_form_strings';

interface LocaleParams {
  action: LocaleAction;
  locale_id?: string;
  key?: string;
  value?: string;
  property?: string;
}

export function handleLocale(
  registry: ProjectRegistry,
  projectId: string,
  params: LocaleParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'set_string':
        return wrapDispatch(project, 'locale.setString', {
          localeId: params.locale_id,
          key: params.key!,
          value: params.value!,
        });

      case 'remove_string':
        return wrapDispatch(project, 'locale.removeString', {
          localeId: params.locale_id,
          key: params.key!,
        });

      case 'list_strings': {
        if (params.locale_id) {
          const locale = project.localeAt(params.locale_id);
          if (!locale) {
            return errorResponse(formatToolError(
              'COMMAND_FAILED',
              `Locale not found: ${params.locale_id}`,
            ));
          }
          return successResponse({ strings: locale.strings });
        }
        // No locale_id: list all locales with their strings
        const locales: Record<string, Record<string, string>> = {};
        for (const [code, loc] of Object.entries(project.locales)) {
          locales[code] = loc.strings;
        }
        return successResponse({ locales });
      }

      case 'set_form_string':
        return wrapDispatch(project, 'locale.setMetadata', {
          localeId: params.locale_id,
          property: params.property!,
          value: params.value!,
        });

      case 'list_form_strings': {
        const locale = project.localeAt(params.locale_id!);
        if (!locale) {
          return errorResponse(formatToolError(
            'COMMAND_FAILED',
            `Locale not found: ${params.locale_id}`,
          ));
        }
        return successResponse({
          form_strings: {
            name: locale.name,
            title: locale.title,
            description: locale.description,
            version: locale.version,
            url: locale.url,
          },
        });
      }

      default:
        return errorResponse(formatToolError(
          'COMMAND_FAILED',
          `Unknown locale action: ${params.action}`,
        ));
    }
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── Internal helpers ─────────────────────────────────────────────────

function wrapDispatch(project: any, type: string, payload: Record<string, unknown>) {
  try {
    project.core.dispatch({ type, payload });
    return successResponse({
      summary: `${type} applied`,
      affectedPaths: [],
      warnings: [],
    });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
