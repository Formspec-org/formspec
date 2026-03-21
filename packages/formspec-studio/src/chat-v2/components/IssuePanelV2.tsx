/** @filedesc Modern issue queue panel with severity badges and resolve/defer actions — v2. */
import React from 'react';
import { useChatSession, useChatState } from '../state/ChatContext.js';
import type { Issue } from 'formspec-chat';

export function IssuePanelV2() {
  const session = useChatSession();
  const state = useChatState();
  const openIssues = state.issues.filter(i => i.status === 'open');

  if (openIssues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
        <div className="v2-empty-icon-sm w-9 h-9 rounded-xl flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8l4 4 6-6" />
          </svg>
        </div>
        <p className="text-sm v2-text-secondary">No issues found</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto scrollbar-none px-3 py-3">
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

const severityStyles: Record<string, { dot: string; badge: string }> = {
  error: { dot: 'v2-dot-error', badge: 'v2-severity-error' },
  warning: { dot: 'v2-dot-warning', badge: 'v2-severity-warning' },
  info: { dot: 'v2-dot-info', badge: 'v2-severity-info' },
};

function IssueItem({ issue, onResolve, onDefer }: { issue: Issue; onResolve: () => void; onDefer: () => void }) {
  const styles = severityStyles[issue.severity] ?? severityStyles.info;

  return (
    <li className="v2-issue-card rounded-xl px-3.5 py-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${styles.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`${styles.badge} inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded-md capitalize`}>
              {issue.severity}
            </span>
            <span className="text-sm font-medium v2-text-primary leading-snug">{issue.title}</span>
          </div>
          <p className="text-xs v2-text-secondary mt-1 leading-relaxed">{issue.description}</p>
        </div>
      </div>
      <div className="flex gap-2 pl-4">
        <button onClick={onResolve} className="v2-issue-action-primary px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all duration-150">
          Resolve
        </button>
        <button onClick={onDefer} className="v2-issue-action-secondary px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all duration-150">
          Defer
        </button>
      </div>
    </li>
  );
}
