/** @filedesc Panel displaying the persistent issue queue (errors, warnings, contradictions) with resolve/defer actions. */
import React from 'react';
import { useChatSession, useChatState } from '../state/ChatContext.js';
import type { Issue } from 'formspec-chat';

const severityConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  error: {
    bg: 'bg-error/8',
    text: 'text-error',
    border: 'border-error/20',
    dot: 'bg-error',
  },
  warning: {
    bg: 'bg-amber/8',
    text: 'text-amber',
    border: 'border-amber/20',
    dot: 'bg-amber',
  },
  info: {
    bg: 'bg-accent/8',
    text: 'text-accent',
    border: 'border-accent/20',
    dot: 'bg-accent',
  },
};

/**
 * Displays the persistent issue queue — unresolved items, contradictions,
 * and low-confidence elements. Each issue can be resolved or deferred.
 */
export function IssuePanel() {
  const session = useChatSession();
  const state = useChatState();

  const openIssues = state.issues.filter(i => i.status === 'open');

  if (openIssues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
        <div className="w-8 h-8 rounded-full bg-green/10 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green" aria-hidden="true">
            <path d="M2.5 7l3 3 6-6" />
          </svg>
        </div>
        <p className="text-sm text-muted">No issues found</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto px-4 py-4">
      <ul className="space-y-2" role="list">
        {openIssues.map(issue => (
          <IssueItem
            key={issue.id}
            issue={issue}
            onResolve={() => session.resolveIssue(issue.id)}
            onDefer={() => session.deferIssue(issue.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function IssueItem({
  issue,
  onResolve,
  onDefer,
}: {
  issue: Issue;
  onResolve: () => void;
  onDefer: () => void;
}) {
  const config = severityConfig[issue.severity] ?? severityConfig.info;

  return (
    <li className="rounded-md border border-border bg-surface px-3.5 py-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        {/* Severity dot */}
        <span className={`mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full ${config.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${config.bg} ${config.text} ${config.border}`}
            >
              {issue.severity}
            </span>
            <span className="text-sm font-medium text-ink leading-snug">{issue.title}</span>
          </div>
          <p className="text-xs text-muted mt-1 leading-relaxed">{issue.description}</p>
        </div>
      </div>
      <div className="flex gap-2 pl-4">
        <button
          onClick={onResolve}
          className="px-2.5 py-1 text-[11px] font-medium rounded border border-border text-muted hover:text-ink hover:border-accent/50 hover:bg-accent/[0.03] transition-all duration-100"
        >
          Resolve
        </button>
        <button
          onClick={onDefer}
          className="px-2.5 py-1 text-[11px] font-medium rounded border border-transparent text-muted/60 hover:text-muted hover:border-border transition-all duration-100"
        >
          Defer
        </button>
      </div>
    </li>
  );
}
