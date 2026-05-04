/** @filedesc Evidence workbench for source documents, citation coverage, conflicts, and field provenance. */
import { useMemo, useRef } from 'react';
import { getStudioIntelligence, type FieldProvenance } from '@formspec-org/studio-core';
import { useProject } from '../../state/useProject';
import { useProjectState } from '../../state/useProjectState';
import { updateStudioExtension } from '../shared/studio-intelligence-writer';
import type { FormItem } from '@formspec-org/studio-core';

interface FieldRow {
  ref: string;
  label: string;
  provenance?: FieldProvenance;
}

function flattenFields(items: readonly FormItem[] | undefined, prefix = 'items'): FieldRow[] {
  const rows: FieldRow[] = [];
  for (const item of items ?? []) {
    if (typeof item.key !== 'string') continue;
    const ref = `${prefix}.${item.key}`;
    if (item.type === 'field') rows.push({ ref, label: typeof item.label === 'string' && item.label ? item.label : item.key });
    if (Array.isArray(item.children)) rows.push(...flattenFields(item.children, ref));
  }
  return rows;
}

function toneFor(status: string | undefined): string {
  if (status === 'confirmed') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
  if (status === 'conflict') return 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200';
}

export function EvidenceWorkspace() {
  const project = useProject();
  const state = useProjectState();
  const inputRef = useRef<HTMLInputElement>(null);
  const intelligence = getStudioIntelligence(state);
  const coverage = intelligence.evidence.coverage;
  const documents = intelligence.evidence.documents;
  const fields = useMemo(() => {
    const provenanceByRef = new Map(intelligence.provenance.map((entry) => [entry.objectRef, entry]));
    return flattenFields(state.definition.items).map((field) => ({
      ...field,
      provenance: provenanceByRef.get(field.ref),
    }));
  }, [intelligence.provenance, state.definition.items]);

  const handleUpload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const id = `${file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'source'}-${Date.now().toString(36)}`;
    updateStudioExtension(project, (draft) => ({
      ...draft,
      evidence: {
        documents: [
          ...draft.evidence.documents,
          { id, name: file.name, mimeType: file.type || 'application/octet-stream', fieldRefs: [] },
        ],
      },
    }));
    if (inputRef.current) inputRef.current.value = '';
  };

  const linkFieldToDocument = (fieldRef: string) => {
    const document = documents[0];
    if (!document) return;
    updateStudioExtension(project, (draft) => {
      const nextDocuments = draft.evidence.documents.map((doc) => doc.id === document.id
        ? { ...doc, fieldRefs: [...new Set([...doc.fieldRefs, fieldRef])] }
        : doc);
      const existing = draft.provenance.filter((entry) => entry.objectRef !== fieldRef);
      return {
        ...draft,
        evidence: { documents: nextDocuments },
        provenance: [
          ...existing,
          {
            objectRef: fieldRef,
            origin: 'evidence',
            rationale: `Supported by ${document.name}.`,
            confidence: 'high',
            sourceRefs: [`evidence.${document.id}`],
            patchRefs: [],
            reviewStatus: 'confirmed',
          },
        ],
      };
    });
  };

  return (
    <div className="flex h-full min-h-0 bg-surface">
      <aside className="hidden w-[280px] shrink-0 border-r border-border bg-surface lg:flex lg:flex-col" aria-label="Evidence documents">
        <div className="flex items-center justify-between px-6 h-[52px] border-b border-border shrink-0">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-normal text-muted">Intelligence</p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent text-surface hover:bg-accent/90 text-[10px] font-bold uppercase tracking-normal transition-all shadow-sm"
            onClick={() => inputRef.current?.click()}
          >
            <span className="text-[13px] leading-none">+</span> Add Source
          </button>
        </div>
        
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.txt,.md,.json,application/pdf,text/plain,application/json" onChange={(event) => handleUpload(event.currentTarget.files)} />
        
        <div className="flex-1 overflow-y-auto px-6 py-8 scrollbar-none">
          <div className="space-y-6">
            <p className="text-[10px] font-bold uppercase tracking-normal text-muted">Source Documents ({documents.length})</p>
            
            {documents.length === 0 ? (
              <button
                type="button"
                className="w-full rounded border border-dashed border-border px-6 py-10 text-center bg-subtle hover:bg-subtle/80 group"
                onClick={() => inputRef.current?.click()}
              >
                <p className="text-[12px] text-muted font-bold leading-relaxed">
                  Upload PDF, text, or JSON sources to start citation coverage.
                </p>
              </button>
            ) : (
              <div className="space-y-3">
                {documents.map((document) => (
                  <div key={document.id} className="group relative rounded border border-border bg-surface p-4 shadow-sm hover:border-accent/40 transition-all duration-300">
                    <div className="flex flex-col gap-1 mb-3">
                      <p className="text-[13px] font-bold text-ink tracking-tight truncate">{document.name}</p>
                      <span className="text-[9px] font-bold uppercase tracking-normal text-muted">{document.mimeType}</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="h-1 overflow-hidden rounded bg-subtle">
                        <div className="h-full rounded bg-accent" style={{ width: `${Math.min(100, document.fieldRefs.length * 20)}%` }} />
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-bold text-muted">{document.fieldRefs.length} linked fields</span>
                         <span className="text-[10px] font-bold text-accent uppercase tracking-normal">{Math.min(100, document.fieldRefs.length * 20)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-8 md:px-12 lg:px-16 scrollbar-none">
        <div className="flex flex-wrap items-end justify-between gap-8 border-b border-border pb-8 mb-8">
          <div className="max-w-[640px]">
            <p className="text-[10px] font-bold uppercase tracking-normal text-accent mb-2">Coverage Analysis</p>
            <h1 className="text-[32px] leading-tight font-bold tracking-tight text-ink mb-4">Evidence Workbench</h1>
            <p className="text-[14px] text-muted font-bold leading-relaxed italic">
              Verified sources manifest as field-level support and cross-referenced citations. Connect your data to its origin.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Covered" value={`${coverage.linkedFields}/${coverage.totalFields}`} accent="emerald" />
            <Metric label="Missing" value={String(coverage.missing)} accent="amber" />
            <Metric label="Conflicts" value={String(coverage.conflicts)} accent="rose" />
          </div>
        </div>

        <div className="rounded border border-border bg-surface overflow-hidden shadow-sm">
          <div className="grid grid-cols-[minmax(200px,1fr)_minmax(200px,1.2fr)_auto] gap-6 px-6 py-3 bg-subtle border-b border-border">
            <span className="text-[10px] font-bold uppercase tracking-normal text-muted">Field Node</span>
            <span className="text-[10px] font-bold uppercase tracking-normal text-muted">Support Provenance</span>
            <span className="text-[10px] font-bold uppercase tracking-normal text-muted text-right pr-4">Actions</span>
          </div>
          <div className="divide-y divide-border">
            {fields.map((field) => {
              const supported = field.provenance?.sourceRefs.length;
              return (
                <div key={field.ref} className="grid grid-cols-[minmax(200px,1fr)_minmax(200px,1.2fr)_auto] items-center gap-6 px-6 py-4 group hover:bg-subtle transition-colors">
                  <div className="flex flex-col">
                    <div className="text-[14px] font-bold text-ink tracking-tight group-hover:text-accent transition-colors">{field.label}</div>
                    <div className="font-mono text-[10px] font-bold text-muted">{field.ref}</div>
                  </div>
                  <div className="space-y-1">
                    <span className={`status-chip inline-flex ${toneFor(field.provenance?.reviewStatus)}`}>
                      {supported ? field.provenance?.sourceRefs.join(', ') : 'Missing Manifestation'}
                    </span>
                    {field.provenance?.rationale && (
                      <p className="text-[12px] text-muted font-bold leading-relaxed line-clamp-2 italic">"{field.provenance.rationale}"</p>
                    )}
                  </div>
                  <div className="flex justify-end pr-2">
                    <button
                      type="button"
                      disabled={documents.length === 0 || !!supported}
                      className="rounded border border-border bg-surface px-4 py-1.5 text-[11px] font-bold text-ink hover:border-accent hover:bg-subtle hover:text-accent transition-all disabled:opacity-20 shadow-sm"
                      onClick={() => linkFieldToDocument(field.ref)}
                    >
                      Link source
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'amber' | 'rose' }) {
  const colors = {
    emerald: 'text-emerald-600 border-emerald-100 bg-emerald-50/[0.04]',
    amber: 'text-amber-600 border-amber-100 bg-amber-50/[0.04]',
    rose: 'text-rose-600 border-rose-100 bg-rose-50/[0.04]'
  };

  return (
    <div className={`min-w-[100px] rounded border px-4 py-3 shadow-sm ${colors[accent]}`}>
      <div className="text-[24px] leading-none font-bold tracking-tight mb-1.5">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-normal opacity-60">{label}</div>
    </div>
  );
}
