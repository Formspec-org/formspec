/** @filedesc Full-screen generated form preview with field list, data-type badges, source traces, and diff highlights. */
import React, { useMemo } from 'react';
import { useChatState } from '../state/ChatContext.js';
import type { SourceTrace, DefinitionDiff } from 'formspec-chat';

interface OptionLike {
  value: string;
  label: string;
}

interface ItemLike {
  key: string;
  type: 'field' | 'group' | 'display';
  label: string;
  description?: string;
  hint?: string;
  dataType?: string;
  options?: OptionLike[];
  children?: ItemLike[];
}

/**
 * Full-screen form preview showing the generated definition.
 * Renders a structured field list with source traces, data type badges,
 * and diff highlighting after refinements.
 */
export function FormPreview() {
  const state = useChatState();
  const { definition: def, lastDiff: diff, traces } = state;

  const tracesByPath = useMemo(() => {
    const map = new Map<string, SourceTrace[]>();
    for (const t of traces) {
      const list = map.get(t.elementPath) ?? [];
      list.push(t);
      map.set(t.elementPath, list);
    }
    return map;
  }, [traces]);

  const diffKeys = useMemo(() => diff ? {
    added: new Set(diff.added),
    removed: new Set(diff.removed),
    modified: new Set(diff.modified),
  } : null, [diff]);

  if (!def) {
    return (
      <div
        data-testid="form-preview"
        className="flex flex-col items-center justify-center h-full gap-3 px-6"
      >
        <div className="w-10 h-10 rounded-full bg-subtle flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden="true">
            <rect x="3" y="2" width="12" height="14" rx="1.5" />
            <line x1="6" y1="6" x2="12" y2="6" />
            <line x1="6" y1="9" x2="12" y2="9" />
            <line x1="6" y1="12" x2="9" y2="12" />
          </svg>
        </div>
        <p className="text-sm text-muted text-center max-w-[200px] leading-relaxed">
          No form yet. Start a conversation or pick a template.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="form-preview" className="h-full overflow-y-auto bg-bg-default">
      <div className="max-w-[640px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Form header */}
        <div className="space-y-2 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-ink">{def.title}</h2>
          {def.description && (
            <p className="text-sm text-muted leading-relaxed">{def.description}</p>
          )}
          <div className="flex items-center gap-3 pt-1">
            {traces.length > 0 && (
              <MetaChip>{traces.length} {traces.length === 1 ? 'trace' : 'traces'}</MetaChip>
            )}
            {state.openIssueCount > 0 && (
              <MetaChip className="text-amber">{state.openIssueCount} {state.openIssueCount === 1 ? 'issue' : 'issues'}</MetaChip>
            )}
          </div>
        </div>

        {/* Diff summary */}
        {diff && <DiffSummary diff={diff} />}

        {/* Items */}
        <div className="space-y-2.5">
          {def.items.map((item: ItemLike) => (
            <ItemPreview
              key={item.key}
              item={item}
              tracesByPath={tracesByPath}
              diffKeys={diffKeys}
              depth={0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetaChip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] text-muted ${className}`}>{children}</span>
  );
}

function DiffSummary({ diff }: { diff: DefinitionDiff }) {
  const parts: { label: string; color: string }[] = [];
  if (diff.added.length > 0) parts.push({ label: `+${diff.added.length} added`, color: 'text-green' });
  if (diff.modified.length > 0) parts.push({ label: `~${diff.modified.length} modified`, color: 'text-amber' });
  if (diff.removed.length > 0) parts.push({ label: `-${diff.removed.length} removed`, color: 'text-error' });

  return (
    <div
      data-testid="diff-summary"
      className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/[0.04] border border-accent/15 text-xs"
    >
      <span className="font-medium text-accent/80 mr-0.5">Changes</span>
      {parts.length > 0 ? (
        parts.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-muted/40">·</span>}
            <span className={p.color}>{p.label}</span>
          </React.Fragment>
        ))
      ) : (
        <span className="text-muted">No structural changes</span>
      )}
    </div>
  );
}

interface DiffKeySet {
  added: Set<string>;
  removed: Set<string>;
  modified: Set<string>;
}

function getDiffStatus(key: string, diffKeys: DiffKeySet | null): 'added' | 'modified' | null {
  if (!diffKeys) return null;
  if (diffKeys.added.has(key)) return 'added';
  if (diffKeys.modified.has(key)) return 'modified';
  return null;
}

function diffBorderClass(status: 'added' | 'modified' | null): string {
  if (status === 'added') return 'border-green/40 bg-green/[0.03]';
  if (status === 'modified') return 'border-amber/40 bg-amber/[0.03]';
  return 'border-border bg-surface';
}

function ItemPreview({
  item,
  tracesByPath,
  diffKeys,
  depth,
}: {
  item: ItemLike;
  tracesByPath: Map<string, SourceTrace[]>;
  diffKeys: DiffKeySet | null;
  depth: number;
}) {
  const itemTraces = tracesByPath.get(item.key) ?? [];
  const diffStatus = getDiffStatus(item.key, diffKeys);

  if (item.type === 'group') {
    return (
      <div
        className={`${depth > 0 ? 'ml-4' : ''}`}
        data-diff={diffStatus ?? undefined}
      >
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted/70">{item.label}</h3>
          {diffStatus && <DiffBadge status={diffStatus} />}
        </div>
        {item.description && (
          <p className="text-xs text-muted mb-2">{item.description}</p>
        )}
        {itemTraces.map((t, i) => (
          <TraceTag key={i} trace={t} />
        ))}
        {item.children && (
          <div className="space-y-2 border-l-2 border-border/60 pl-3 mt-2">
            {item.children.map(child => (
              <ItemPreview key={child.key} item={child} tracesByPath={tracesByPath} diffKeys={diffKeys} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (item.type === 'display') {
    return (
      <div
        className={`py-1 ${depth > 0 ? 'ml-4' : ''}`}
        data-diff={diffStatus ?? undefined}
      >
        <div className="text-xs italic text-muted/70">{item.label}</div>
        {itemTraces.map((t, i) => (
          <TraceTag key={i} trace={t} />
        ))}
      </div>
    );
  }

  // field
  return (
    <div
      className={`rounded-md border px-3.5 py-3 space-y-2 ${depth > 0 ? 'ml-4' : ''} ${diffBorderClass(diffStatus)}`}
      data-diff={diffStatus ?? undefined}
      data-field-type={item.dataType ?? undefined}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-ink leading-snug">{item.label}</span>
        {item.dataType && (
          <TypeBadge>{item.dataType}</TypeBadge>
        )}
        {diffStatus && <DiffBadge status={diffStatus} />}
      </div>
      {item.description && (
        <p className="text-xs text-muted leading-relaxed">{item.description}</p>
      )}
      <FieldMockup item={item} />
      {itemTraces.map((t, i) => (
        <TraceTag key={i} trace={t} />
      ))}
    </div>
  );
}

function TypeBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/8 text-accent/80 border border-accent/15 font-mono">
      {children}
    </span>
  );
}

const mockInputBase = 'w-full rounded border border-border bg-bg-default px-2.5 py-1.5 text-xs text-muted/70 pointer-events-none';

function FieldMockup({ item }: { item: ItemLike }) {
  const dt = item.dataType;

  if (dt === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-xs text-muted/70 pointer-events-none">
        <input type="checkbox" disabled className="rounded border-border" />
        <span>{item.hint ?? item.label}</span>
      </label>
    );
  }

  if (dt === 'choice' && item.options) {
    return (
      <select disabled className={mockInputBase}>
        <option value="">Select...</option>
        {item.options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (dt === 'multiChoice' && item.options) {
    return (
      <div className="space-y-1">
        {item.options.map(o => (
          <label key={o.value} className="flex items-center gap-2 text-xs text-muted/70 pointer-events-none">
            <input type="checkbox" disabled className="rounded border-border" />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (dt === 'text') {
    return (
      <textarea
        disabled
        rows={2}
        placeholder={item.hint ?? `Enter ${item.label.toLowerCase()}...`}
        className={`${mockInputBase} resize-none`}
      />
    );
  }

  if (dt === 'date') {
    return <input type="date" disabled className={mockInputBase} />;
  }

  if (dt === 'integer' || dt === 'decimal') {
    return (
      <input type="number" disabled placeholder={item.hint ?? '0'} className={mockInputBase} />
    );
  }

  return (
    <input
      type="text"
      disabled
      placeholder={item.hint ?? `Enter ${item.label.toLowerCase()}...`}
      className={mockInputBase}
    />
  );
}

function DiffBadge({ status }: { status: 'added' | 'modified' }) {
  const styles = {
    added: 'bg-green/8 text-green border-green/20',
    modified: 'bg-amber/8 text-amber border-amber/20',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function TraceTag({ trace }: { trace: SourceTrace }) {
  return (
    <div className="flex items-center gap-1 text-[11px] text-muted/50 mt-0.5">
      <span className="text-accent/40">↳</span>
      <span>{trace.description}</span>
    </div>
  );
}
