/** @filedesc Full-screen generated form preview with field list, data-type badges, source traces, diff highlights, and JSON document inspector. */
import React, { useMemo, useState, useCallback } from 'react';
import { useChatState, useChatSession } from '../state/ChatContext.js';
import type { SourceTrace, DefinitionDiff } from 'formspec-chat';
import { planDefinitionFallback } from 'formspec-layout';
import type { LayoutNode } from 'formspec-layout';

interface OptionLike {
  value: string;
  label: string;
}

/** Partial item interface for Screener items. */
interface ItemLike {
  key: string;
  type: 'field' | 'group' | 'display';
  label: string;
  description?: string;
  hint?: string;
  dataType?: string;
  options?: OptionLike[];
  optionSet?: string;
  presentation?: any;
}

type PreviewMode = 'visual' | 'json';

/**
 * Full-screen form preview showing the generated definition.
 * Renders a structured field list with source traces, data type badges,
 * and diff highlighting after refinements. Toggles to a JSON document
 * inspector for debugging the raw bundle artifacts.
 */
export function FormPreview() {
  const session = useChatSession();
  const state = useChatState();
  const { definition: def, lastDiff: diff, traces } = state;
  const [mode, setMode] = useState<PreviewMode>('visual');
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = useCallback(async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      await session.regenerate();
    } finally {
      setRegenerating(false);
    }
  }, [session, regenerating]);

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

  const layoutPlan = useMemo(() => {
    if (!def) return null;
    
    // Find item by key (supports dotted paths)
    const findItem = (key: string) => {
      const segments = key.split('.');
      let current: any[] = def.items;
      for (let i = 0; i < segments.length; i++) {
        const found = current.find(it => it.key === segments[i]);
        if (!found) return null;
        if (i === segments.length - 1) return found;
        current = found.children || [];
      }
      return null;
    };

    return planDefinitionFallback(def.items, {
      items: def.items,
      formPresentation: def.formPresentation,
      theme: state.bundle?.theme,
      findItem,
    });
  }, [def, state.bundle?.theme]);

  // Streaming scaffold in progress — show live JSON
  if (state.scaffoldingText != null) {
    return (
      <div data-testid="form-preview" className="flex flex-col h-full bg-bg-default">
        <div className="flex items-center gap-2 p-2 border-b border-border bg-surface shrink-0">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-medium text-muted">Generating...</span>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-subtle/30">
          <pre className="font-mono text-xs text-ink bg-surface border border-border rounded p-4 overflow-x-auto min-h-0 whitespace-pre-wrap">
            <code>{state.scaffoldingText || 'Waiting for response...'}</code>
          </pre>
        </div>
      </div>
    );
  }

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
    <div data-testid="form-preview" className="flex flex-col h-full bg-bg-default">
      {/* Mode toggle bar */}
      <div className="flex items-center gap-1 p-2 border-b border-border bg-surface shrink-0">
        {(['visual', 'json'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`px-3 py-1 text-sm rounded capitalize ${
              mode === m
                ? 'bg-accent text-white'
                : 'text-muted hover:text-ink hover:bg-subtle'
            }`}
            onClick={() => setMode(m)}
            data-testid={`preview-mode-${m}`}
          >
            {m === 'visual' ? 'Preview' : 'JSON'}
          </button>
        ))}
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          title="Regenerate form from entire chat history"
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-border text-muted hover:text-ink hover:border-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="regenerate-btn"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={regenerating ? 'animate-spin' : ''}>
            <path d="M1 6a5 5 0 018.5-3.5L11 1" />
            <path d="M11 1v3H8" />
            <path d="M11 6a5 5 0 01-8.5 3.5L1 11" />
            <path d="M11 1V8h3" />
          </svg>
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>

      {mode === 'json' ? (
        <BundleJsonView bundle={state.bundle} />
      ) : (
      <div className="flex-1 overflow-y-auto">
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

        {/* Screener section */}
        {def.screener && (
          <div className="space-y-4 pt-2 pb-6 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-accent/40 rounded-full" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted/70">Screener</h3>
            </div>
            <div className="space-y-2.5">
              {def.screener.items.map((item: ItemLike) => (
                <ItemPreview
                  key={item.key}
                  item={item}
                  tracesByPath={tracesByPath}
                  diffKeys={diffKeys}
                />
              ))}
            </div>
            <div className="bg-subtle/20 rounded-md p-3 border border-border/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted/50 mb-2">Routes</div>
              <div className="space-y-1.5">
                {def.screener.routes.map((route: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-accent/60 mt-0.5">→</span>
                    <div className="flex-1">
                      <div className="font-medium text-ink">{route.label || 'Unnamed Route'}</div>
                      <div className="font-mono text-[10px] text-muted/60 mt-0.5">{route.condition}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Items rendered via layout plan */}
        <div className="space-y-6">
          {layoutPlan?.map((node) => (
            <LayoutNodePreview
              key={node.id}
              node={node}
              tracesByPath={tracesByPath}
              diffKeys={diffKeys}
            />
          ))}
        </div>
      </div>
      </div>
      )}
    </div>
  );
}

// ── Layout Node Preview ──────────────────────────────────────────────

function LayoutNodePreview({
  node,
  tracesByPath,
  diffKeys,
}: {
  node: LayoutNode;
  tracesByPath: Map<string, SourceTrace[]>;
  diffKeys: DiffKeySet | null;
}) {
  const bindPath = node.bindPath;
  const traces = bindPath ? tracesByPath.get(bindPath) ?? [] : [];
  const diffStatus = bindPath ? getDiffStatus(bindPath, diffKeys) : null;

  // ── Layout Components ──

  if (node.component === 'Stack' || node.component === 'Page') {
    const title = node.props.title as string | undefined;
    return (
      <div className="space-y-3" data-diff={diffStatus ?? undefined}>
        {title && (
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted/70">{title}</h3>
            {node.repeatGroup && (
              <span className="text-[10px] px-1 py-0 rounded bg-accent/10 text-accent/80 border border-accent/20">
                Repeatable
              </span>
            )}
            {diffStatus && <DiffBadge status={diffStatus} />}
          </div>
        )}
        {traces.map((t, i) => <TraceTag key={i} trace={t} />)}
        <div className="space-y-4">
          {node.children.map(child => (
            <LayoutNodePreview key={child.id} node={child} tracesByPath={tracesByPath} diffKeys={diffKeys} />
          ))}
        </div>
      </div>
    );
  }

  if (node.component === 'Grid') {
    const cols = (node.props.columns as number) || 12;
    return (
      <div 
        className="grid gap-4" 
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {node.children.map(child => (
          <LayoutNodePreview key={child.id} node={child} tracesByPath={tracesByPath} diffKeys={diffKeys} />
        ))}
      </div>
    );
  }

  if (node.component === 'Wizard' || node.component === 'Tabs') {
    return (
      <div className="space-y-4 border border-border/40 rounded-lg p-4 bg-subtle/5">
        <div className="flex items-center gap-2 pb-2 border-b border-border/40">
          <div className="px-2 py-0.5 rounded bg-accent text-white text-[10px] font-bold uppercase">{node.component}</div>
          <div className="text-[10px] text-muted font-medium italic">Logic-controlled pagination</div>
        </div>
        <div className="space-y-6">
          {node.children.map((child, i) => (
            <div key={child.id} className="space-y-4">
               {i > 0 && <div className="h-px bg-border/20 border-dashed border-b" />}
               <LayoutNodePreview node={child} tracesByPath={tracesByPath} diffKeys={diffKeys} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Field Components ──

  if (node.category === 'field' && node.fieldItem) {
    const item = node.fieldItem;
    const presentation = node.presentation;
    const colSpan = (node.props.colSpan as number) || (node.style?.gridColumn as string)?.match(/span (\d+)/)?.[1];

    return (
      <div
        className={`rounded-md border px-3.5 py-3 space-y-2 ${diffBorderClass(diffStatus)}`}
        style={colSpan ? { gridColumn: `span ${colSpan} / span ${colSpan}` } : undefined}
        data-diff={diffStatus ?? undefined}
        data-field-type={item.dataType ?? undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-sm font-medium text-ink leading-snug">{item.label}</span>
            {item.hint && (
              <p className="text-xs text-muted leading-relaxed">{item.hint}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {item.dataType && <TypeBadge>{item.dataType}</TypeBadge>}
            {diffStatus && <DiffBadge status={diffStatus} />}
          </div>
        </div>
        
        <FieldMockup item={{ ...item, presentation } as any} />
        
        {traces.map((t, i) => <TraceTag key={i} trace={t} />)}

        {node.children.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/40 space-y-3 bg-subtle/20 -mx-3.5 px-3.5 pb-2 rounded-b-md">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted/50 mb-2">Dependent Fields</div>
            {node.children.map(child => (
              <LayoutNodePreview key={child.id} node={child} tracesByPath={tracesByPath} diffKeys={diffKeys} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Display Components ──

  if (node.category === 'display') {
    const text = (node.props.text as string) || '';
    if (node.component === 'Heading') {
      return (
        <div className="pt-4 pb-1 border-b border-border/60">
          <h4 className="text-sm font-semibold text-ink">{text}</h4>
        </div>
      );
    }
    if (node.component === 'Divider') {
      return <div className="py-4"><div className="h-px bg-border/60" /></div>;
    }
    if (node.component === 'Alert') {
      return (
        <div className="p-3 rounded-md bg-accent/5 border border-accent/10 text-xs text-accent/80 leading-relaxed">
          {text}
        </div>
      );
    }
    return (
      <div className="py-1" data-diff={diffStatus ?? undefined}>
        <div className="text-xs italic text-muted/70 leading-relaxed">{text}</div>
        {traces.map((t, i) => <TraceTag key={i} trace={t} />)}
      </div>
    );
  }

  // Fallback for generic containers
  if (node.children.length > 0) {
    return (
      <div className="space-y-2">
        {node.children.map(child => (
          <LayoutNodePreview key={child.id} node={child} tracesByPath={tracesByPath} diffKeys={diffKeys} />
        ))}
      </div>
    );
  }

  return null;
}

// ── Bundle JSON Inspector ──────────────────────────────────────────

const BUNDLE_DOC_IDS = ['Definition', 'Component', 'Theme', 'Mappings'] as const;
type BundleDocId = (typeof BUNDLE_DOC_IDS)[number];

function BundleJsonView({ bundle }: { bundle: import('formspec-studio-core').ProjectBundle | null }) {
  const [active, setActive] = useState<BundleDocId>('Definition');
  const [activeMapping, setActiveMapping] = useState<string | null>(null);

  const mappings = bundle?.mappings ?? {};
  const mappingKeys = Object.keys(mappings);

  // Auto-select first mapping if none selected and we're on Mappings tab
  if (active === 'Mappings' && !activeMapping && mappingKeys.length > 0) {
    setActiveMapping(mappingKeys[0]);
  }

  const doc = bundle ? {
    Definition: bundle.definition,
    Component: bundle.component,
    Theme: bundle.theme,
    Mappings: activeMapping ? mappings[activeMapping] : mappings,
  }[active] : null;

  const formatted = (() => {
    try { return JSON.stringify(doc, null, 2); }
    catch { return String(doc); }
  })();

  const isEmpty = doc == null
    || (typeof doc === 'object' && !Array.isArray(doc) && Object.keys(doc).length === 0);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(isEmpty ? '(empty)' : formatted); }
    catch { /* best-effort */ }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-surface shrink-0">
        {BUNDLE_DOC_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`px-3 py-1 text-sm rounded ${
              active === id
                ? 'bg-accent text-white'
                : 'text-muted hover:text-ink hover:bg-subtle'
            }`}
            onClick={() => setActive(id)}
            data-testid={`json-doc-${id.toLowerCase()}`}
          >
            {id}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto px-3 py-1 text-sm rounded border border-border text-muted hover:text-ink hover:bg-subtle"
          onClick={handleCopy}
        >
          Copy
        </button>
      </div>

      {active === 'Mappings' && mappingKeys.length > 1 && (
        <div className="flex gap-1 p-2 border-b border-border bg-surface/50 shrink-0 overflow-x-auto">
          {mappingKeys.map((key) => (
            <button
              key={key}
              type="button"
              className={`px-2 py-0.5 text-[11px] font-medium rounded border whitespace-nowrap ${
                activeMapping === key
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'bg-surface text-muted border-border hover:bg-subtle'
              }`}
              onClick={() => setActiveMapping(key)}
            >
              {key}.json
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 bg-subtle/30">
        <pre
          className="font-mono text-xs text-ink bg-surface border border-border rounded p-4 overflow-x-auto min-h-0"
          data-testid={`json-doc-${active.toLowerCase()}-content`}
        >
          <code>{isEmpty ? '(empty)' : formatted}</code>
        </pre>
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
}: {
  item: ItemLike;
  tracesByPath: Map<string, SourceTrace[]>;
  diffKeys: DiffKeySet | null;
}) {
  const itemTraces = tracesByPath.get(item.key) ?? [];
  const diffStatus = getDiffStatus(item.key, diffKeys);

  if (item.type === 'group') {
    return (
      <div className="group/item" data-diff={diffStatus ?? undefined}>
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted/70">{item.label}</h3>
          {diffStatus && <DiffBadge status={diffStatus} />}
        </div>
        {item.description && (
          <p className="text-xs text-muted mb-2 leading-relaxed">{item.description}</p>
        )}
        {itemTraces.map((t, i) => <TraceTag key={i} trace={t} />)}
      </div>
    );
  }

  if (item.type === 'display') {
    return (
      <div className="py-1" data-diff={diffStatus ?? undefined}>
        <div className="text-xs italic text-muted/70 leading-relaxed">{item.label}</div>
        {itemTraces.map((t, i) => <TraceTag key={i} trace={t} />)}
      </div>
    );
  }

  // field
  return (
    <div
      className={`rounded-md border px-3.5 py-3 space-y-2 ${diffBorderClass(diffStatus)}`}
      data-diff={diffStatus ?? undefined}
      data-field-type={item.dataType ?? undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <span className="text-sm font-medium text-ink leading-snug">{item.label}</span>
          {item.description && (
            <p className="text-xs text-muted leading-relaxed">{item.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.dataType && <TypeBadge>{item.dataType}</TypeBadge>}
          {diffStatus && <DiffBadge status={diffStatus} />}
        </div>
      </div>
      
      <FieldMockup item={item} />
      
      {itemTraces.map((t, i) => <TraceTag key={i} trace={t} />)}
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

const mockInputBase = 'w-full rounded border border-border bg-bg-default px-2.5 py-1.5 text-xs text-muted/70 pointer-events-none transition-colors';

function FieldMockup({ item }: { item: ItemLike }) {
  const dt = item.dataType;
  const hint = item.presentation?.widgetHint?.toLowerCase();

  if (dt === 'boolean') {
    if (hint === 'toggle') {
      return (
        <div className="flex items-center gap-2 pointer-events-none">
          <div className="w-8 h-4.5 rounded-full bg-subtle border border-border relative">
            <div className="absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
          </div>
          <span className="text-xs text-muted/70">{item.hint ?? item.label}</span>
        </div>
      );
    }
    return (
      <label className="flex items-center gap-2 text-xs text-muted/70 pointer-events-none">
        <input type="checkbox" disabled className="rounded border-border" />
        <span>{item.hint ?? item.label}</span>
      </label>
    );
  }

  if ((dt === 'choice' || dt === 'multiChoice') && (item.options || item.optionSet)) {
    const options = item.options ?? [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2' },
    ];

    if (hint === 'radio' || hint === 'checkboxgroup') {
      return (
        <div className="space-y-1.5">
          {options.map(o => (
            <label key={o.value} className="flex items-center gap-2 text-xs text-muted/70 pointer-events-none">
              <input 
                type={dt === 'choice' ? 'radio' : 'checkbox'} 
                disabled 
                className={`border-border ${dt === 'choice' ? 'rounded-full' : 'rounded'}`}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }

    if (dt === 'multiChoice') {
      return (
        <div className="space-y-1.5">
          {options.slice(0, 3).map(o => (
            <label key={o.value} className="flex items-center gap-2 text-xs text-muted/70 pointer-events-none">
              <input type="checkbox" disabled className="rounded border-border" />
              <span>{o.label}</span>
            </label>
          ))}
          {options.length > 3 && (
            <div className="text-[10px] text-muted/40 pl-6">...and {options.length - 3} more</div>
          )}
        </div>
      );
    }

    return (
      <div className="relative">
        <select disabled className={mockInputBase}>
          <option value="">{item.optionSet ? `[Option Set: ${item.optionSet}]` : 'Select...'}</option>
          {item.options?.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted/40">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4l3 3 3-3" />
          </svg>
        </div>
      </div>
    );
  }

  if (dt === 'text' || hint === 'textarea') {
    return (
      <textarea
        disabled
        rows={2}
        placeholder={item.hint ?? `Enter ${item.label.toLowerCase()}...`}
        className={`${mockInputBase} resize-none`}
      />
    );
  }

  if (dt === 'date' || dt === 'datetime' || dt === 'dateTime' || dt === 'time') {
    const icon = (
      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/40">
        {dt.toLowerCase().includes('time') ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M6 3v3h2" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="8" height="7" rx="1" />
            <path d="M2 5h8M4 2v2M8 2v2" />
          </svg>
        )}
      </div>
    );
    return (
      <div className="relative">
        {icon}
        <input
          type="text"
          disabled
          placeholder={dt.toLowerCase().includes('time') ? 'HH:MM' : 'YYYY-MM-DD'}
          className={`${mockInputBase} pl-8`}
        />
      </div>
    );
  }

  if (dt === 'integer' || dt === 'decimal') {
    if (hint === 'slider') {
      return (
        <div className="space-y-2 pointer-events-none">
          <div className="h-1.5 w-full bg-subtle rounded-full relative">
            <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border border-border shadow-sm" />
          </div>
          <div className="flex justify-between text-[10px] text-muted/40">
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      );
    }
    return (
      <div className="relative">
        <input type="number" disabled placeholder={item.hint ?? '0'} className={mockInputBase} />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 text-muted/30">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 5l2.5-2.5 2.5 2.5" />
          </svg>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 3l2.5 2.5 2.5-2.5" />
          </svg>
        </div>
      </div>
    );
  }

  if (dt === 'money') {
    return (
      <div className="relative">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/50 font-medium text-xs">$</div>
        <input
          type="text"
          disabled
          placeholder="0.00"
          className={`${mockInputBase} pl-6 font-mono text-right pr-3`}
        />
      </div>
    );
  }

  if (dt === 'attachment') {
    return (
      <div className="border border-dashed border-border rounded-md p-4 bg-subtle/10 flex flex-col items-center justify-center gap-2 pointer-events-none">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/30">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <span className="text-[10px] text-muted/50 font-medium">Upload File</span>
      </div>
    );
  }

  if (dt === 'uri') {
    return (
      <div className="relative">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/40">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3H3a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V7M9 1L6 4M7 1h2v2" />
          </svg>
        </div>
        <input
          type="text"
          disabled
          placeholder="https://..."
          className={`${mockInputBase} pl-8`}
        />
      </div>
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
