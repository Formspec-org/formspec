/** @filedesc Proposed artifact block — inline read-only form preview for changeset review in chat. */
import { useMemo, type ReactElement } from 'react';
import type { FormDefinition } from '@formspec-org/types';

export interface ProposedArtifactBlockProps {
  /** The proposed definition state to render. */
  definition: FormDefinition;
  /** Label for the changeset (e.g. "Added 3 fields, reorganized address group"). */
  summary?: string;
  /** Called when the user accepts all changes. */
  onAccept: () => void;
  /** Called when the user wants to review individual changes. */
  onReviewDetails: () => void;
  /** Called when the user wants to tweak via further chat. */
  onTweak: () => void;
  /** Called when the user rejects the proposal. */
  onReject?: () => void;
  /** Current status of the AI operation */
  status?: 'generating' | 'refining' | 'complete';
}

/**
 * ProposedArtifactBlock — renders as a first-class artifact review block
 * attached to an assistant proposal when a changeset is structural.
 *
 * Chat supplies intent and rationale; this block is the thing being accepted.
 * ~240px max height with scroll; [Accept all] [Review details] [Tweak it].
 */
export function ProposedArtifactBlock({
  definition,
  summary,
  onAccept,
  onReviewDetails,
  onTweak,
  onReject,
  status = 'complete',
}: ProposedArtifactBlockProps): ReactElement {
  const fieldCount = useMemo(() => countFields(definition.items ?? []), [definition.items]);

  return (
    <div
      className="rounded-[2.5rem] border border-accent/30 bg-accent/[0.02] overflow-hidden shadow-premium-lg animate-onboarding-enter"
      data-testid="proposed-artifact-block"
    >
      {/* Preview area */}
      <div className="max-h-[320px] overflow-y-auto px-6 py-6 scrollbar-none">
        <div className="glass rounded-[2rem] border border-border/30 px-6 py-6 shadow-premium-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${status === 'complete' ? 'bg-accent' : 'bg-amber animate-pulse'} shadow-[0_0_10px_rgba(var(--color-accent-rgb),0.4)]`} />
              <span className={`font-display text-[11px] font-black uppercase tracking-[0.25em] ${status === 'complete' ? 'text-accent' : 'text-amber'}`}>
                {status === 'generating' ? 'Writing Structure' : status === 'refining' ? 'Refining Layout' : 'Proposed Manifest'}
              </span>
            </div>
            <div className="px-3 py-1 rounded-full bg-subtle/50 border border-border/40 text-[10px] font-black uppercase tracking-widest text-muted">
              {fieldCount} field{fieldCount === 1 ? '' : 's'}
            </div>
          </div>
          {summary && (
            <p className="text-[14px] font-medium text-ink/80 leading-relaxed mb-4 italic border-l-2 border-accent/20 pl-4">"{summary}"</p>
          )}
          
          <div className="mb-4">
             <p className="font-display text-[18px] font-bold text-ink mb-1 tracking-tight">{definition.title ?? 'Untitled Form'}</p>
          </div>

          <div className="space-y-2 border-l-[3px] border-border/10 pl-5 ml-1">
            {(definition.items ?? []).slice(0, 8).map((item: any) => (
              <div key={item.key} className="flex items-center gap-3 group">
                <span className={`flex items-center justify-center w-5 h-5 rounded-lg text-[10px] font-black ${item.type === 'group' ? 'bg-accent text-white' : 'bg-subtle text-muted'}`}>
                  {item.type === 'group' ? 'G' : 'F'}
                </span>
                <span className="text-[13px] font-semibold text-ink/70 group-hover:text-ink transition-colors tracking-tight">{item.label ?? item.key}</span>
                {item.type === 'group' && item.children && (
                  <span className="text-[10px] font-black text-muted uppercase tracking-widest">({item.children.length})</span>
                )}
              </div>
            ))}
            {(definition.items ?? []).length > 8 && (
              <div className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mt-4 ml-1">
                + {(definition.items ?? []).length - 8} additional entities
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      {status === 'complete' ? (
        <div className="flex items-center gap-3 px-6 py-4 border-t border-accent/10 bg-accent/[0.04] backdrop-blur-sm">
          <button
            type="button"
            data-testid="accept-proposal"
            className="rounded-2xl bg-accent px-6 py-2.5 text-[13px] font-bold text-white hover:bg-accent-hover shadow-premium-lg transition-all active:scale-95"
            onClick={onAccept}
          >
            Accept changes
          </button>
          <button
            type="button"
            data-testid="review-proposal"
            className="rounded-2xl border border-border/40 bg-surface px-5 py-2.5 text-[13px] font-bold text-ink hover:bg-subtle hover:border-accent/20 transition-all active:scale-95"
            onClick={onReviewDetails}
          >
            Details
          </button>
          <button
            type="button"
            data-testid="tweak-proposal"
            className="rounded-2xl border border-border/40 bg-surface px-5 py-2.5 text-[13px] font-bold text-muted hover:text-ink hover:bg-subtle transition-all active:scale-95"
            onClick={onTweak}
          >
            Tweak
          </button>
          <div className="flex-1" />
          {onReject && (
            <button
              type="button"
              data-testid="reject-proposal"
              className="rounded-2xl px-4 py-2.5 text-[13px] font-bold text-muted hover:text-rose-500 hover:bg-rose-50 transition-all"
              onClick={onReject}
            >
              Reject
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between px-8 py-5 border-t border-accent/10 bg-accent/[0.04] backdrop-blur-sm">
          <div className="flex items-center gap-4 text-[13px] font-bold text-accent italic">
            <svg className="animate-spin h-5 w-5 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="tracking-tight">{status === 'generating' ? 'Drafting Blueprint...' : 'Evaluating Rules...'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function countFields(items: any[]): number {
  let count = 0;
  for (const item of items) {
    if (item.type === 'field') count++;
    if (item.children) count += countFields(item.children);
  }
  return count;
}
