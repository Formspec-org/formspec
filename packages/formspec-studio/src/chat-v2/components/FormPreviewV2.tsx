/** @filedesc Modern form preview with field mockups, source traces, diff highlights, and JSON inspector — v2. */
import React, { useMemo, useState, useCallback } from 'react';
import { useChatState, useChatSession } from '../state/ChatContext.js';
import type { SourceTrace, DefinitionDiff } from '@formspec-org/chat';
import { planDefinitionFallback } from '@formspec-org/layout';
import type { LayoutNode, PresentationBlock } from '@formspec-org/layout';
import type { FormItem } from '@formspec-org/types';
import { IconRotate, IconUpload, IconStack as IconFile } from '../../components/icons';

interface OptionLike {
  value: string;
  label: string;
}

interface FieldMockupItem {
  key: string;
  label: string;
  hint?: string;
  dataType?: string;
  options?: OptionLike[];
  optionSet?: string;
  presentation?: PresentationBlock;
}

type PreviewMode = 'visual' | 'json';

export function FormPreviewV2() {
  const session = useChatSession();
  const state = useChatState();
  const { definition: def, lastDiff: diff, traces } = state;
  const [mode, setMode] = useState<PreviewMode>('visual');
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = useCallback(async () => {
    if (regenerating) return;
    setRegenerating(true);
    try { await session.regenerate(); }
    finally { setRegenerating(false); }
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
    const findItem = (key: string) => {
      const segments = key.split('.');
      let current: FormItem[] = def.items;
      for (let i = 0; i < segments.length; i++) {
        const found = current.find((it) => it.key === segments[i]);
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

  // Streaming scaffold
  if (state.scaffoldingText != null) {
    return (
      <div data-testid="form-preview" className="v2-preview flex flex-col h-full">
        <div className="v2-preview-header flex items-center gap-2.5 px-4 py-3 shrink-0">
          <div className="w-2 h-2 rounded-full v2-pulse-dot" />
          <span className="text-xs font-medium v2-text-secondary">Generating...</span>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <pre className="v2-code-block font-mono text-xs rounded-xl p-5 overflow-x-auto min-h-0 whitespace-pre-wrap">
            <code>{state.scaffoldingText || 'Waiting for response...'}</code>
          </pre>
        </div>
      </div>
    );
  }

  if (!def) {
    return (
      <div data-testid="form-preview" className="v2-preview flex flex-col items-center justify-center h-full gap-4 px-6">
        <div className="v2-empty-icon w-12 h-12 rounded-2xl flex items-center justify-center">
          <IconFile size={20} />
        </div>
        <p className="text-sm v2-text-secondary text-center max-w-[220px] leading-relaxed">
          No form yet. Start a conversation or pick a template.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="form-preview" className="v2-preview flex flex-col h-full">
      {/* Mode toggle bar */}
      <div className="v2-preview-header flex items-center gap-1.5 px-3 py-2 shrink-0">
        <div className="v2-tab-group flex items-center rounded-lg p-0.5">
          {(['visual', 'json'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              className={`v2-tab px-3.5 py-1.5 text-xs font-medium rounded-md capitalize transition-all duration-150 ${
                mode === m ? 'v2-tab-active' : ''
              }`}
              onClick={() => setMode(m)}
              data-testid={`preview-mode-${m}`}
            >
              {m === 'visual' ? 'Preview' : 'JSON'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          title="Regenerate form from entire chat history"
          className="v2-regen-btn ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-150 disabled:opacity-40"
          data-testid="regenerate-btn"
        >
          <IconRotate size={12} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>

      {mode === 'json' ? (
        <BundleJsonView bundle={state.bundle} />
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-none">
          <div className="max-w-[640px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
            {/* Form header */}
            <div className="space-y-2 pb-5">
              <h2 className="text-lg font-bold v2-text-primary">{def.title}</h2>
              {def.description && (
                <p className="text-sm v2-text-secondary leading-relaxed">{def.description}</p>
              )}
              <div className="flex items-center gap-3 pt-1.5">
                {traces.length > 0 && (
                  <MetaChip>{traces.length} {traces.length === 1 ? 'trace' : 'traces'}</MetaChip>
                )}
                {state.openIssueCount > 0 && (
                  <MetaChip className="v2-chip-warning">{state.openIssueCount} {state.openIssueCount === 1 ? 'issue' : 'issues'}</MetaChip>
                )}
              </div>
            </div>

            {diff && <DiffSummary diff={diff} />}

            {/* Items via layout plan */}
            <div className="space-y-5">
              {layoutPlan?.map((node) => (
                <LayoutNodePreview key={node.id} node={node} tracesByPath={tracesByPath} diffKeys={diffKeys} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Layout Node Preview ──────────────────────────────────────────────

interface DiffKeySet {
  added: Set<string>;
  removed: Set<string>;
  modified: Set<string>;
}

function LayoutNodePreview({ node, tracesByPath, diffKeys }: {
  node: LayoutNode;
  tracesByPath: Map<string, SourceTrace[]>;
  diffKeys: DiffKeySet | null;
}) {
  const bindPath = node.bindPath;
  const traces = bindPath ? tracesByPath.get(bindPath) ?? [] : [];
  const diffStatus = bindPath ? getDiffStatus(bindPath, diffKeys) : null;

  if (node.component === 'Stack' || node.component === 'Page') {
    const title = node.props.title as string | undefined;
    return (
      <div className="space-y-3">
        {title && (
          <div className="flex items-center gap-2 mb-1">
            <h3 className="v2-section-label text-[11px] font-bold uppercase tracking-wider">{title}</h3>
            {node.repeatGroup && (
              <span className="v2-chip-accent text-[10px] px-1.5 py-0.5 rounded-md font-medium">Repeatable</span>
            )}
            {diffStatus && <DiffBadge status={diffStatus} />}
          </div>
        )}
        {traces.map((t, i) => <TraceTag key={i} trace={t} />)}
        <div className="space-y-4">{node.children.map(child => <LayoutNodePreview key={child.id} node={child} tracesByPath={tracesByPath} diffKeys={diffKeys} />)}</div>
      </div>
    );
  }

  if (node.component === 'Grid') {
    const cols = (node.props.columns as number) || 12;
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {node.children.map(child => <LayoutNodePreview key={child.id} node={child} tracesByPath={tracesByPath} diffKeys={diffKeys} />)}
      </div>
    );
  }

  if (node.component === 'Tabs') {
    return (
      <div className="v2-wizard-box space-y-4 rounded-xl p-4">
        <div className="flex items-center gap-2 pb-2 border-b v2-border">
          <div className="v2-chip-accent px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">{node.component}</div>
          <div className="text-[10px] v2-text-tertiary font-medium italic">Logic-controlled pagination</div>
        </div>
        <div className="space-y-6">
          {node.children.map((child, i) => (
            <div key={child.id} className="space-y-4">
              {i > 0 && <div className="h-px v2-divider" />}
              <LayoutNodePreview node={child} tracesByPath={tracesByPath} diffKeys={diffKeys} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Field components
  if (node.category === 'field' && node.fieldItem) {
    const item = node.fieldItem;
    const presentation = node.presentation;
    const colSpan = (node.props.colSpan as number) || (node.style?.gridColumn as string)?.match(/span (\d+)/)?.[1];

    return (
      <div
        className={`v2-field-card rounded-xl px-4 py-3.5 space-y-2.5 ${diffBorderClass(diffStatus)}`}
        style={colSpan ? { gridColumn: `span ${colSpan} / span ${colSpan}` } : undefined}
        data-diff={diffStatus ?? undefined}
        data-field-type={item.dataType ?? undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-sm font-medium v2-text-primary leading-snug">{item.label}</span>
            {item.hint && <p className="text-xs v2-text-secondary leading-relaxed">{item.hint}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {item.dataType && <TypeBadge>{item.dataType}</TypeBadge>}
            {diffStatus && <DiffBadge status={diffStatus} />}
          </div>
        </div>
        <FieldMockup item={{ ...item, presentation }} />
        {traces.map((t, i) => <TraceTag key={i} trace={t} />)}
        {node.children.length > 0 && (
          <div className="v2-dependent-fields mt-3 pt-3 space-y-3 -mx-4 px-4 pb-2 rounded-b-xl">
            <div className="v2-text-tertiary text-[10px] font-bold uppercase tracking-wider mb-2">Dependent Fields</div>
            {node.children.map(child => <LayoutNodePreview key={child.id} node={child} tracesByPath={tracesByPath} diffKeys={diffKeys} />)}
          </div>
        )}
      </div>
    );
  }

  // Display components
  if (node.category === 'display') {
    const text = (node.props.text as string) || '';
    if (node.component === 'Heading') {
      return (
        <div className="pt-4 pb-1 border-b v2-border">
          <h4 className="text-sm font-semibold v2-text-primary">{text}</h4>
        </div>
      );
    }
    if (node.component === 'Divider') return <div className="py-4"><div className="h-px v2-divider" /></div>;
    if (node.component === 'Alert') {
      return <div className="v2-alert-box p-3.5 rounded-xl text-xs leading-relaxed">{text}</div>;
    }
    return (
      <div className="py-1">
        <div className="text-xs italic v2-text-tertiary leading-relaxed">{text}</div>
        {traces.map((t, i) => <TraceTag key={i} trace={t} />)}
      </div>
    );
  }

  if (node.children.length > 0) {
    return <div className="space-y-2">{node.children.map(child => <LayoutNodePreview key={child.id} node={child} tracesByPath={tracesByPath} diffKeys={diffKeys} />)}</div>;
  }

  return null;
}

// ── Bundle JSON Inspector ────────────────────────────────────────────

const BUNDLE_DOC_IDS = ['Definition', 'Component', 'Theme', 'Mappings'] as const;
type BundleDocId = (typeof BUNDLE_DOC_IDS)[number];

function BundleJsonView({ bundle }: { bundle: import('@formspec-org/studio-core').ProjectBundle | null }) {
  const [active, setActive] = useState<BundleDocId>('Definition');
  const [activeMapping, setActiveMapping] = useState<string | null>(null);

  const mappings = bundle?.mappings ?? {};
  const mappingKeys = Object.keys(mappings);

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

  const isEmpty = doc == null || (typeof doc === 'object' && !Array.isArray(doc) && Object.keys(doc).length === 0);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(isEmpty ? '(empty)' : formatted); }
    catch { /* best-effort */ }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="v2-json-tabs flex flex-wrap gap-1 p-2 shrink-0">
        {BUNDLE_DOC_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`v2-tab px-3 py-1.5 text-xs font-medium rounded-md ${active === id ? 'v2-tab-active' : ''}`}
            onClick={() => setActive(id)}
            data-testid={`json-doc-${id.toLowerCase()}`}
          >
            {id}
          </button>
        ))}
        <button
          type="button"
          className="v2-regen-btn ml-auto px-3 py-1.5 text-xs rounded-lg font-medium"
          onClick={handleCopy}
        >
          Copy
        </button>
      </div>

      {active === 'Mappings' && mappingKeys.length > 1 && (
        <div className="flex gap-1 p-2 shrink-0 overflow-x-auto v2-json-tabs">
          {mappingKeys.map((key) => (
            <button
              key={key}
              type="button"
              className={`v2-tab px-2.5 py-1 text-[11px] font-medium rounded-md whitespace-nowrap ${activeMapping === key ? 'v2-tab-active' : ''}`}
              onClick={() => setActiveMapping(key)}
            >
              {key}.json
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        <pre className="v2-code-block font-mono text-xs rounded-xl p-5 overflow-x-auto min-h-0" data-testid={`json-doc-${active.toLowerCase()}-content`}>
          <code>{isEmpty ? '(empty)' : formatted}</code>
        </pre>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function MetaChip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`v2-meta-chip text-[11px] ${className}`}>{children}</span>;
}

function DiffSummary({ diff }: { diff: DefinitionDiff }) {
  const parts: { label: string; cls: string }[] = [];
  if (diff.added.length > 0) parts.push({ label: `+${diff.added.length} added`, cls: 'v2-diff-added' });
  if (diff.modified.length > 0) parts.push({ label: `~${diff.modified.length} modified`, cls: 'v2-diff-modified' });
  if (diff.removed.length > 0) parts.push({ label: `-${diff.removed.length} removed`, cls: 'v2-diff-removed' });

  return (
    <div data-testid="diff-summary" className="v2-diff-summary flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs">
      <span className="font-semibold v2-text-accent mr-0.5">Changes</span>
      {parts.length > 0 ? parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="v2-text-tertiary">&middot;</span>}
          <span className={p.cls}>{p.label}</span>
        </React.Fragment>
      )) : <span className="v2-text-secondary">No structural changes</span>}
    </div>
  );
}

function getDiffStatus(key: string, diffKeys: DiffKeySet | null): 'added' | 'modified' | null {
  if (!diffKeys) return null;
  if (diffKeys.added.has(key)) return 'added';
  if (diffKeys.modified.has(key)) return 'modified';
  return null;
}

function diffBorderClass(status: 'added' | 'modified' | null): string {
  if (status === 'added') return 'v2-field-added';
  if (status === 'modified') return 'v2-field-modified';
  return '';
}

function TypeBadge({ children }: { children: React.ReactNode }) {
  return <span className="v2-type-badge text-[10px] px-1.5 py-0.5 rounded-md font-mono font-medium">{children}</span>;
}

function DiffBadge({ status }: { status: 'added' | 'modified' }) {
  return (
    <span className={`v2-diff-badge text-[10px] px-1.5 py-0.5 rounded-md font-medium ${status === 'added' ? 'v2-diff-badge-added' : 'v2-diff-badge-modified'}`}>
      {status}
    </span>
  );
}

function TraceTag({ trace }: { trace: SourceTrace }) {
  return (
    <div className="flex items-center gap-1 text-[11px] v2-text-tertiary mt-0.5">
      <span className="v2-text-accent opacity-60">&#8627;</span>
      <span>{trace.description}</span>
    </div>
  );
}

// ── Field Mockups ────────────────────────────────────────────────────

function FieldMockup({ item }: { item: FieldMockupItem }) {
  const dt = item.dataType;
  const hint = item.presentation?.widget?.toLowerCase();
  const mockBase = 'v2-mock-input w-full rounded-lg px-3 py-2 text-xs pointer-events-none';

  if (dt === 'boolean') {
    if (hint === 'toggle') {
      return (
        <div className="flex items-center gap-2.5 pointer-events-none">
          <div className="v2-toggle w-9 h-5 rounded-full relative">
            <div className="v2-toggle-knob absolute left-0.5 top-0.5 w-4 h-4 rounded-full" />
          </div>
          <span className="text-xs v2-text-tertiary">{item.hint ?? item.label}</span>
        </div>
      );
    }
    return (
      <label className="flex items-center gap-2 text-xs v2-text-tertiary pointer-events-none">
        <input type="checkbox" disabled className="rounded" />
        <span>{item.hint ?? item.label}</span>
      </label>
    );
  }

  if ((dt === 'choice' || dt === 'multiChoice') && (item.options || item.optionSet)) {
    const options = item.options ?? [{ value: '1', label: 'Option 1' }, { value: '2', label: 'Option 2' }];

    if (hint === 'radio' || hint === 'checkboxgroup') {
      return (
        <div className="space-y-2">
          {options.map(o => (
            <label key={o.value} className="flex items-center gap-2 text-xs v2-text-tertiary pointer-events-none">
              <input type={dt === 'choice' ? 'radio' : 'checkbox'} disabled className={dt === 'choice' ? 'rounded-full' : 'rounded'} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }

    if (dt === 'multiChoice') {
      return (
        <div className="space-y-2">
          {options.slice(0, 3).map(o => (
            <label key={o.value} className="flex items-center gap-2 text-xs v2-text-tertiary pointer-events-none">
              <input type="checkbox" disabled className="rounded" />
              <span>{o.label}</span>
            </label>
          ))}
          {options.length > 3 && <div className="text-[10px] v2-text-tertiary pl-6">...and {options.length - 3} more</div>}
        </div>
      );
    }

    return (
      <div className="relative">
        <select disabled className={mockBase}>
          <option value="">{item.optionSet ? `[Option Set: ${item.optionSet}]` : 'Select...'}</option>
          {item.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (dt === 'text' || hint === 'textarea') {
    return <textarea disabled rows={2} placeholder={item.hint ?? `Enter ${item.label.toLowerCase()}...`} className={`${mockBase} resize-none`} />;
  }

  if (dt === 'date' || dt === 'datetime' || dt === 'dateTime' || dt === 'time') {
    return <input type="text" disabled placeholder={dt.toLowerCase().includes('time') ? 'HH:MM' : 'YYYY-MM-DD'} className={mockBase} />;
  }

  if (dt === 'integer' || dt === 'decimal') {
    if (hint === 'slider') {
      return (
        <div className="space-y-2 pointer-events-none">
          <div className="v2-slider h-1.5 w-full rounded-full relative">
            <div className="v2-slider-thumb absolute left-1/4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full" />
          </div>
          <div className="flex justify-between text-[10px] v2-text-tertiary"><span>0</span><span>100</span></div>
        </div>
      );
    }
    return <input type="number" disabled placeholder={item.hint ?? '0'} className={mockBase} />;
  }

  if (dt === 'money') {
    return (
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 v2-text-tertiary font-medium text-xs">$</div>
        <input type="text" disabled placeholder="0.00" className={`${mockBase} pl-7 font-mono text-right pr-3`} />
      </div>
    );
  }

  if (dt === 'attachment') {
    return (
      <div className="v2-upload-zone rounded-xl p-5 flex flex-col items-center justify-center gap-2 pointer-events-none">
        <IconUpload size={20} className="v2-text-tertiary" />
        <span className="text-[10px] v2-text-tertiary font-medium">Upload File</span>
      </div>
    );
  }

  if (dt === 'uri') {
    return <input type="text" disabled placeholder="https://..." className={mockBase} />;
  }

  return <input type="text" disabled placeholder={item.hint ?? `Enter ${item.label.toLowerCase()}...`} className={mockBase} />;
}
