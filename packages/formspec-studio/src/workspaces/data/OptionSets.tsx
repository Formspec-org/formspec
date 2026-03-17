/** @filedesc Panel for creating and editing named option sets (static choices or data-sourced) on a form. */
import { useState } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useProject } from '../../state/useProject';
import { flatItems } from '../../lib/field-helpers';
import { InlineExpression } from '../../components/ui/InlineExpression';

interface OptionEntry {
  value: string;
  label: string;
}

interface OptionSetDef {
  options?: OptionEntry[];
  source?: string;
  valueField?: string;
  labelField?: string;
}

export function OptionSets() {
  const definition = useDefinition();
  const project = useProject();
  const optionSets = (definition?.optionSets as unknown as Record<string, OptionSetDef>) || {};
  const items = (definition?.items as any[]) || [];
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    project.defineChoices(trimmed, []);
    setExpandedName(trimmed);
    setNewName('');
    setIsAdding(false);
  };

  const handleSetProperty = (name: string, property: string, value: unknown) => {
    project.updateOptionSet(name, property, value);
  };

  const handleDelete = (name: string) => {
    if (window.confirm(`Delete "${name}"? Its options will be inlined into referencing fields.`)) {
      project.deleteOptionSet(name);
      if (expandedName === name) setExpandedName(null);
    }
  };

  const sanitizeName = (raw: string) => raw.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/_+$/, '');

  // Count how many fields reference each option set
  const flat = flatItems(items);
  const usageCounts: Record<string, number> = {};
  for (const { item } of flat) {
    const ref = item.optionSet as string | undefined;
    if (ref) {
      usageCounts[ref] = (usageCounts[ref] || 0) + 1;
    }
  }

  const entries = Object.entries(optionSets);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Active Tables</h4>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
          >
            + New Table
          </button>
        )}
      </div>

      {/* Inline add form */}
      {isAdding && (
        <div className="border border-accent/30 rounded-xl bg-accent/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              placeholder="state_codes"
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
            e.g. <code className="font-mono text-accent/70">state_codes</code>, <code className="font-mono text-accent/70">severity_levels</code>, <code className="font-mono text-accent/70">departments</code>
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
      {entries.length === 0 && !isAdding && (
        <div className="py-8 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center px-6">
          <p className="text-sm text-muted font-medium mb-2">No lookup tables defined.</p>
          <p className="text-[12px] text-muted/70 leading-relaxed max-w-[400px]">
            Option sets are reusable lists of choices shared across fields.
            Reference them on a field with <code className="font-mono text-accent/70">"optionSet": "name"</code>.
          </p>
        </div>
      )}

      {/* Option set cards */}
      {entries.map(([name, os]) => {
        const isExpanded = expandedName === name;
        const isRemote = !!os.source;
        const optionCount = os.options?.length ?? 0;
        const refs = usageCounts[name] || 0;

        return (
          <div
            key={name}
            data-testid={`option-set-${name}`}
            className={`rounded-xl border transition-all ${isExpanded ? 'border-accent shadow-md ring-1 ring-accent/10 bg-surface' : 'border-border bg-surface/50 hover:border-muted hover:bg-surface'}`}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() => setExpandedName(isExpanded ? null : name)}
            >
              <div>
                <div className="font-bold text-[14px] text-ink">{name}</div>
                {!isExpanded && (
                  <div className="text-[11px] text-muted truncate max-w-[400px] mt-1">
                    {isRemote ? `Remote: ${os.source}` : `${optionCount} options`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div className="text-[10px] text-muted font-mono uppercase tracking-wider text-right">
                  {refs} Ref{refs !== 1 ? 's' : ''}
                </div>
                <div className={`text-[12px] text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</div>
              </div>
            </div>

            {/* Expanded editor */}
            {isExpanded && (
              <div className="p-6 pt-0 border-t border-border animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="space-y-6 mt-4">
                  {/* Usage hint */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-accent/5 rounded-lg border border-accent/10">
                    <span className="text-[11px] text-muted">Reference on a field:</span>
                    <code className="text-[12px] font-mono font-bold text-accent">"optionSet": "{name}"</code>
                  </div>

                  {isRemote ? (
                    /* Remote source editing */
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] block">Source Endpoint</label>
                      <InlineExpression
                        value={os.source || ''}
                        onSave={(val) => handleSetProperty(name, 'source', val)}
                        placeholder="https://api.example.com/options"
                        className="block w-full text-[13px] bg-subtle border border-border rounded-lg px-3 py-2.5 hover:border-accent/50 hover:bg-subtle/70 underline decoration-accent/30 decoration-dotted underline-offset-4"
                      />
                      <p className="text-[10px] text-muted/60 italic">
                        Must return a JSON array of objects with value/label fields.
                      </p>
                    </div>
                  ) : (
                    /* Manual options table */
                    <section>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Option Entries</label>
                        <button
                          type="button"
                          onClick={() => handleSetProperty(name, 'options', [...(os.options || []), { value: '', label: '' }])}
                          className="text-[10px] font-bold text-accent hover:underline"
                        >
                          + Add Row
                        </button>
                      </div>
                      <div className="border border-border rounded-lg overflow-hidden bg-subtle/20">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-subtle/50 text-[9px] font-bold text-muted uppercase tracking-widest border-b border-border">
                            <tr>
                              <th className="py-2 px-4">Value</th>
                              <th className="py-2 px-4">Label</th>
                              <th className="py-2 px-4 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {(os.options || []).map((opt, i) => (
                              <tr key={i} className="hover:bg-subtle/30 group">
                                <td className="p-1 px-4">
                                  <input
                                    className="w-full bg-transparent border-none focus:ring-0 font-mono text-[12px]"
                                    value={opt.value}
                                    onChange={(e) => {
                                      const next = [...(os.options || [])];
                                      next[i] = { ...next[i], value: e.target.value };
                                      handleSetProperty(name, 'options', next);
                                    }}
                                    onBlur={() => {
                                      handleSetProperty(name, 'options', os.options || []);
                                    }}
                                    placeholder="key"
                                  />
                                </td>
                                <td className="p-1 px-4">
                                  <input
                                    className="w-full bg-transparent border-none focus:ring-0 text-[12px]"
                                    value={opt.label}
                                    onChange={(e) => {
                                      const next = [...(os.options || [])];
                                      next[i] = { ...next[i], label: e.target.value };
                                      handleSetProperty(name, 'options', next);
                                    }}
                                    placeholder="Display Text"
                                  />
                                </td>
                                <td className="p-1 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleSetProperty(name, 'options', (os.options || []).filter((_, idx) => idx !== i))}
                                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-error transition-all"
                                  >✕</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(!os.options || os.options.length === 0) && (
                          <div className="py-6 text-center text-[12px] text-muted italic">No options defined. Click "+ Add Row" to start.</div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted/60 italic mt-1.5">
                        Value is stored in the response. Label is what the user sees.
                      </p>
                    </section>
                  )}

                  <div className="pt-4 border-t border-border flex justify-end">
                    <button
                      type="button"
                      aria-label="Delete table"
                      onClick={() => handleDelete(name)}
                      className="text-[10px] font-bold text-muted hover:text-error uppercase tracking-widest transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
