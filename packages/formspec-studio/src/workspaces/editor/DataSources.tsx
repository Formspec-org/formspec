/** @filedesc Panel for viewing and editing inline data sources attached to the form definition. */
import { useState } from 'react';
import { sanitizeIdentifier } from '@formspec-org/studio-core';
import { useProject } from '../../state/useProject';
import { useDefinition } from '../../state/useDefinition';
import { InlineExpression } from '../../components/ui/InlineExpression';
import { InlineCreateForm } from '../../components/shared/InlineCreateForm';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ExpandableCard } from '../../components/shared/ExpandableCard';
import { EmptyWorkspaceState } from '../../components/shared/EmptyWorkspaceState';

function InlineDataEditor({ data, hasSource, onSave }: {
  data: unknown;
  hasSource: boolean;
  onSave: (parsed: unknown) => void;
}) {
  const formatted = data != null ? JSON.stringify(data, null, 2) : '';
  const [draft, setDraft] = useState(formatted);
  const [error, setError] = useState<string | null>(null);

  // Sync draft when data changes externally
  const stableFormatted = data != null ? JSON.stringify(data, null, 2) : '';
  if (stableFormatted !== formatted && draft === formatted) {
    setDraft(stableFormatted);
  }

  const handleBlur = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError(null);
      if (data != null) onSave(null);
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      setError(null);
      onSave(parsed);
    } catch {
      setError('Invalid JSON — check syntax and try again.');
    }
  };

  return (
    <div className="space-y-1.5" data-testid="inline-data-editor">
      <label className="text-[10px] font-bold text-muted uppercase tracking-widest block">
        {hasSource ? 'Fallback Data (inline JSON)' : 'Inline Data (JSON)'}
      </label>
      <textarea
        className={`w-full bg-subtle border rounded-lg px-3 py-2.5 text-[12px] font-mono text-ink outline-none focus:ring-1 resize-y min-h-[80px] ${
          error ? 'border-error focus:ring-error' : 'border-border focus:ring-accent'
        }`}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        onBlur={handleBlur}
        placeholder={'{\n  "key": "value"\n}'}
        spellCheck={false}
      />
      {error && (
        <p className="text-[11px] text-error font-medium">{error}</p>
      )}
      <p className="text-[10px] text-muted/60 italic">
        {hasSource
          ? 'Used as fallback when the source URL is unavailable. Paste any valid JSON.'
          : 'Paste a JSON object or array. This is the data returned by @instance().'}
      </p>
    </div>
  );
}

interface Instance {
  name: string;
  source?: string;
  description?: string;
  data?: unknown;
  schema?: Record<string, string>;
  static?: boolean;
  readonly?: boolean;
}

export function DataSources() {
  const definition = useDefinition();
  const project = useProject();
  const rawInstances = definition?.instances;
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const instances: Instance[] = Object.entries(rawInstances || {}).map(([name, inst]) => ({
    name,
    ...(inst as object),
  }));

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    project.addInstance(trimmed, {});
    setExpandedName(trimmed);
    setNewName('');
    setIsAdding(false);
  };

  const handleSetProperty = (name: string, property: string, value: unknown) => {
    project.updateInstance(name, { [property]: value } as Parameters<typeof project.updateInstance>[1]);
  };

  const handleDelete = (name: string) => {
    setDeleteTarget(name);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      project.removeInstance(deleteTarget);
      if (expandedName === deleteTarget) setExpandedName(null);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete data source"
        description={`Delete data source "${deleteTarget ?? ''}"? FEL expressions using @instance('${deleteTarget ?? ''}') will break.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">External Data Catalog</h4>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
          >
            + Add Source
          </button>
        )}
      </div>

      {/* Inline add form */}
      {isAdding && (
        <InlineCreateForm
          onCancel={() => { setIsAdding(false); setNewName(''); }}
          onCreate={handleAdd}
          example={<span>e.g. <code className="font-mono text-accent/70">patient_record</code>, <code className="font-mono text-accent/70">drug_database</code>, <code className="font-mono text-accent/70">agency_config</code></span>}
        >
          <div className="flex items-center gap-2">
            <span className="text-accent font-mono text-sm font-bold">@</span>
            <input
              autoFocus
              type="text"
              placeholder="patient_record"
              value={newName}
              onChange={(e) => setNewName(sanitizeIdentifier(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setIsAdding(false); setNewName(''); }
              }}
              className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-ink placeholder:text-muted/40"
            />
          </div>
        </InlineCreateForm>
      )}

      {/* Empty state */}
      {instances.length === 0 && !isAdding && (
        <EmptyWorkspaceState
          message="No external sources connected."
          description={
            <>
              Instances let you load data from APIs, files, or inline JSON.
              Reference them in FEL expressions with <code className="font-mono text-accent/70">@instance('name')</code>.
            </>
          }
        />
      )}

      {/* Instance cards */}
      {instances.map((inst) => {
        const isExpanded = expandedName === inst.name;
        const hasSource = !!inst.source;
        const hasInlineData = inst.data !== undefined && inst.data !== null;

        return (
          <ExpandableCard
            key={inst.name}
            data-testid={`instance-${inst.name}`}
            expanded={isExpanded}
            onToggle={() => setExpandedName(isExpanded ? null : inst.name)}
            header={
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[14px] text-ink flex items-center gap-2">
                  {inst.name}
                  {inst.static && (
                    <span className="text-[9px] font-bold text-muted uppercase tracking-tighter border border-border px-1.5 py-0.5 rounded">Cached</span>
                  )}
                  {!hasSource && hasInlineData && (
                    <span className="text-[9px] font-bold text-accent/70 uppercase tracking-tighter border border-accent/20 bg-accent/5 px-1.5 py-0.5 rounded">Inline Data</span>
                  )}
                </div>
                {!isExpanded && (
                  <div className="text-[11px] text-muted truncate max-w-[400px] mt-0.5">
                    {hasSource ? (
                      <span className="font-mono">{inst.source}</span>
                    ) : hasInlineData ? (
                      <span className="italic">Embedded JSON document</span>
                    ) : (
                      <span className="italic">No source configured</span>
                    )}
                  </div>
                )}
              </div>
            }
          >
            <div className="space-y-5">
              {/* FEL usage hint */}
              <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-accent/5 rounded-lg border border-accent/10">
                <span className="text-[11px] text-muted">Use in FEL:</span>
                <code className="text-[12px] font-mono font-bold text-accent">@instance('{inst.name}')</code>
              </div>

              {/* Source URL */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest block">Source URL</label>
                <InlineExpression
                  value={inst.source || ''}
                  onSave={(val) => handleSetProperty(inst.name, 'source', val || null)}
                  placeholder="https://api.example.com/data/{{entityId}}"
                  className="block w-full text-[13px] bg-subtle border border-border rounded-lg px-3 py-2.5 hover:border-accent/50 hover:bg-subtle/70 underline decoration-accent/30 decoration-dotted underline-offset-4"
                />
                <p className="text-[10px] text-muted/60 italic">
                  {"Supports {{template}} variables. Leave empty for inline-only data."}
                </p>
              </div>

              {/* Data format requirements */}
              <div className="rounded-lg border border-border/60 bg-subtle/30 px-4 py-3 space-y-2" data-testid="data-format-info">
                <h5 className="text-[10px] font-bold text-muted uppercase tracking-widest">Data Requirements</h5>
                <ul className="text-[11px] text-muted space-y-1.5 leading-relaxed">
                  <li>
                    <span className="font-bold text-ink">Response must be JSON.</span>{' '}
                    The source URL must return a valid JSON response (object or array).
                  </li>
                  <li>
                    <span className="font-bold text-ink">At least one of source or inline data required.</span>{' '}
                    Provide a URL, embed data directly, or both (inline data acts as fallback if the fetch fails).
                  </li>
                  <li>
                    <span className="font-bold text-ink">Access via dot paths.</span>{' '}
                    <code className="font-mono text-[10px] text-accent/80">@instance('{inst.name}').fieldName</code> navigates into the returned JSON.
                  </li>
                  <li>
                    <span className="font-bold text-ink">Schema is informational.</span>{' '}
                    The schema property aids tooling but does not enforce validation at runtime.
                  </li>
                </ul>
              </div>

              {/* Inline data editor */}
              <InlineDataEditor
                data={inst.data}
                hasSource={hasSource}
                onSave={(parsed) => handleSetProperty(inst.name, 'data', parsed)}
              />

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest block">Description</label>
                <textarea
                  className="w-full bg-subtle border border-border rounded-lg px-3 py-2 text-[12px] text-ink outline-none focus:ring-1 focus:ring-accent resize-none h-16"
                  defaultValue={inst.description || ''}
                  placeholder="Describe what this data source provides..."
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    handleSetProperty(inst.name, 'description', val || null);
                  }}
                />
              </div>

              {/* Behavior toggles */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest block">Behavior</label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label="Static caching"
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent mt-0.5"
                    checked={!!inst.static}
                    onChange={(e) => handleSetProperty(inst.name, 'static', e.target.checked)}
                  />
                  <div>
                    <span className="text-[12px] font-bold text-ink block">Static (Caching)</span>
                    <span className="text-[10px] text-muted/70">Data won't change during this form session. Enables aggressive caching.</span>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label="Read-only"
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent mt-0.5"
                    checked={inst.readonly !== false}
                    onChange={(e) => handleSetProperty(inst.name, 'readonly', e.target.checked)}
                  />
                  <div>
                    <span className="text-[12px] font-bold text-ink block">Read-only</span>
                    <span className="text-[10px] text-muted/70">Prevent calculate binds from writing back. Uncheck for scratch-pad instances.</span>
                  </div>
                </label>
              </div>

              {/* Danger zone */}
              <div className="pt-4 border-t border-border flex justify-end">
                <button
                  type="button"
                  aria-label="Delete data source"
                  onClick={() => handleDelete(inst.name)}
                  className="text-[10px] font-bold text-muted hover:text-error uppercase tracking-widest transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </ExpandableCard>
        );
      })}
    </div>
  );
}
