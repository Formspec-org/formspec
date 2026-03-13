import { useState } from 'react';
import { useDispatch } from '../../state/useDispatch';
import { useDefinition } from '../../state/useDefinition';
import { InlineExpression } from '../../components/ui/InlineExpression';

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
  const dispatch = useDispatch();
  const rawInstances = definition?.instances;
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const instances: Instance[] = Array.isArray(rawInstances)
    ? rawInstances
    : Object.entries(rawInstances || {}).map(([name, inst]) => ({
        name,
        ...(inst as object),
      }));

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    dispatch({
      type: 'definition.addInstance',
      payload: { name: trimmed },
    });
    setExpandedName(trimmed);
    setNewName('');
    setIsAdding(false);
  };

  const handleSetProperty = (name: string, property: string, value: unknown) => {
    dispatch({
      type: 'definition.setInstance',
      payload: { name, property, value },
    });
  };

  const handleDelete = (name: string) => {
    if (window.confirm(`Delete data source "${name}"? FEL expressions using @instance('${name}') will break.`)) {
      dispatch({
        type: 'definition.deleteInstance',
        payload: { name },
      });
      if (expandedName === name) setExpandedName(null);
    }
  };

  const sanitizeName = (raw: string) => raw.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/_+$/, '');

  return (
    <div className="space-y-4">
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
        <div className="border border-accent/30 rounded-xl bg-accent/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-accent font-mono text-sm font-bold">@</span>
            <input
              autoFocus
              type="text"
              placeholder="patient_record"
              value={newName}
              onChange={(e) => setNewName(sanitizeName(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setIsAdding(false); setNewName(''); }
              }}
              className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-ink placeholder:text-muted/40"
            />
          </div>
          <p className="text-[11px] text-muted">
            e.g. <code className="font-mono text-accent/70">patient_record</code>, <code className="font-mono text-accent/70">drug_database</code>, <code className="font-mono text-accent/70">agency_config</code>
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setNewName(''); }}
              className="text-[10px] uppercase font-bold text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="text-[10px] uppercase font-bold text-accent hover:text-accent-hover transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {instances.length === 0 && !isAdding && (
        <div className="py-8 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center px-6">
          <p className="text-sm text-muted font-medium mb-2">No external sources connected.</p>
          <p className="text-[12px] text-muted/70 leading-relaxed max-w-[400px]">
            Instances let you load data from APIs, files, or inline JSON.
            Reference them in FEL expressions with <code className="font-mono text-accent/70">@instance('name')</code>.
          </p>
        </div>
      )}

      {/* Instance cards */}
      {instances.map((inst) => {
        const isExpanded = expandedName === inst.name;
        const hasSource = !!inst.source;
        const hasInlineData = inst.data !== undefined && inst.data !== null;

        return (
          <div
            key={inst.name}
            data-testid={`instance-${inst.name}`}
            className={`group relative bg-surface border rounded-xl transition-all overflow-hidden ${isExpanded ? 'border-accent ring-1 ring-accent/10' : 'border-border'}`}
          >
            {/* Header — click to expand/collapse */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer"
              onClick={() => setExpandedName(isExpanded ? null : inst.name)}
            >
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
              <div className="flex items-center gap-3 ml-2">
                <div className={`text-[12px] text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</div>
              </div>
            </div>

            {/* Expanded editor */}
            {isExpanded && (
              <div className="px-5 pb-5 pt-0 border-t border-border space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
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
            )}
          </div>
        );
      })}
    </div>
  );
}
