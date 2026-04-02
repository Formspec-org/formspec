/** @filedesc Form Health panel — Issues and Output Blueprint in the Editor right rail. */
import { useMemo } from 'react';
import type { FormBind } from '@formspec-org/types';
import {
  buildDefinitionAdvisoryIssues,
  type DefinitionAdvisoryIssue,
} from '@formspec-org/studio-core';
import { OutputBlueprint } from '../../components/blueprint/OutputBlueprint';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';

/** Must match DefinitionTreeEditor / editor canvas selection scope. */
const EDITOR_SELECTION_TAB = 'editor';

export function FormHealthPanel() {
  const definition = useDefinition();
  const { select } = useSelection();

  const issues = useMemo(
    () =>
      buildDefinitionAdvisoryIssues(
        definition.items ?? [],
        definition.binds as FormBind[] | undefined,
      ),
    [definition.items, definition.binds],
  );

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="border-b border-border/80 bg-surface px-5 py-4 shrink-0">
        <h2 className="text-[15px] font-semibold text-ink tracking-tight font-ui">
          Form Health
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          Is your form ready to publish?
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div
          className="px-5 py-4 border-b border-border/60"
          data-testid="issues-list"
          aria-live="polite"
        >
          <h3 className="text-[12px] font-bold text-muted uppercase tracking-wider mb-3">
            Issues
          </h3>
          {issues.length === 0 ? (
            <div className="flex items-center gap-2 text-[13px]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-green-600 dark:text-green-400 shrink-0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M11.5 3.5 L5.5 10 L2.5 7" />
              </svg>
              <span className="text-ink font-medium">No issues found</span>
            </div>
          ) : (
            <ul className="space-y-3">
              {issues.map((issue: DefinitionAdvisoryIssue, i: number) => (
                <li key={`${issue.path}-${i}-${issue.message.slice(0, 24)}`}>
                  <button
                    type="button"
                    data-testid={`form-health-issue-${i}`}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                      issue.severity === 'info'
                        ? 'border-blue-500/35 bg-blue-500/5 hover:bg-blue-500/10 focus-visible:ring-blue-500/40'
                        : 'border-amber-500/35 bg-amber-500/5 hover:bg-amber-500/10 focus-visible:ring-amber-500/40'
                    }`}
                    onClick={() =>
                      select(issue.path, 'field', { tab: EDITOR_SELECTION_TAB })
                    }
                  >
                    <div className="text-[12px] font-semibold text-ink">
                      {issue.label}
                    </div>
                    <div className="font-mono text-[10px] text-muted mt-0.5">
                      {issue.path}
                    </div>
                    <p className="text-[12px] text-ink/85 mt-1.5 leading-snug">
                      {issue.message}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-4">
          <OutputBlueprint />
        </div>
      </div>
    </div>
  );
}
