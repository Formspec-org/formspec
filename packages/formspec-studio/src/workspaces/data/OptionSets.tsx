import { useState } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useDispatch } from '../../state/useDispatch';
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

interface OptionSetsProps {
  onEdit?: (name: string, data: OptionSetDef) => void;
}

export function OptionSets({ onEdit }: OptionSetsProps) {
  const definition = useDefinition();
  const dispatch = useDispatch();
  const optionSets = (definition?.optionSets as unknown as Record<string, OptionSetDef>) || {};
  const items = (definition?.items as any[]) || [];
  const [expandedName, setExpandedName] = useState<string | null>(null);

  const handleAddOptionSet = () => {
    const name = window.prompt('Lookup table name (e.g. state_codes)');
    if (!name?.trim()) return;
    dispatch({
      type: 'definition.setOptionSet',
      payload: { name: name.trim(), options: [] },
    });
    setExpandedName(name.trim());
  };

  const handleUpdate = (name: string, payload: Partial<OptionSetDef>) => {
    dispatch({
      type: 'definition.setOptionSet',
      payload: { name, ...payload },
    });
  };

  const handleDelete = (name: string) => {
    if (window.confirm(`Delete "${name}"? This will break fields that reference it.`)) {
      dispatch({
        type: 'definition.deleteOptionSet',
        payload: { name },
      });
      if (expandedName === name) setExpandedName(null);
    }
  };

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
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Active Tables</h4>
        <button
          type="button"
          onClick={handleAddOptionSet}
          className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
        >
          + New Table
        </button>
      </div>

      {entries.length === 0 && (
        <div className="py-2 text-sm text-muted italic opacity-50">No lookup tables defined.</div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {entries.map(([name, os]) => {
          const isExpanded = expandedName === name;
          const strategy = os.source ? 'remote' : 'manual';

          return (
            <div
              key={name}
              className={`rounded-xl border transition-all ${isExpanded ? 'border-accent shadow-md ring-1 ring-accent/10 bg-surface' : 'border-border bg-surface/50 hover:border-muted hover:bg-surface'}`}
            >
              {/* Header */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpandedName(isExpanded ? null : name)}
              >
                <div>
                  <div className="font-bold text-[14px] text-ink flex items-center gap-2">
                    {name}
                    {isExpanded && <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded uppercase tracking-widest font-bold">Editing</span>}
                  </div>
                  {!isExpanded && (
                    <div className="text-[11px] text-muted truncate max-w-[400px] mt-1">
                      {os.source ? `Remote: ${os.source}` : `${os.options?.length || 0} manual options defined.`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-[10px] text-muted font-mono uppercase tracking-wider text-right">
                    {usageCounts[name] || 0} Ref{(usageCounts[name] || 0) !== 1 ? 's' : ''}
                  </div>
                  <div className={`text-[12px] text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</div>
                </div>
              </div>

              {/* Inline Editor */}
              {isExpanded && (
                <div className="p-6 pt-0 border-t border-border animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-8 mt-6">
                    <section>
                      <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] block mb-3">Provisioning Strategy</label>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleUpdate(name, { source: undefined })}
                          className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-bold transition-all border-2 ${strategy === 'manual' ? 'border-accent bg-accent/5 text-accent' : 'border-border text-muted hover:border-muted'}`}
                        >
                          Manual List
                        </button>
                        <button 
                          onClick={() => handleUpdate(name, { source: 'https://', options: undefined })}
                          className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-bold transition-all border-2 ${strategy === 'remote' ? 'border-accent bg-accent/5 text-accent' : 'border-border text-muted hover:border-muted'}`}
                        >
                          Remote Sync
                        </button>
                      </div>
                    </section>

                    {strategy === 'manual' ? (
                      <section>
                         <div className="flex items-center justify-between mb-3">
                           <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Option Entries</label>
                           <button 
                            onClick={() => handleUpdate(name, { options: [...(os.options || []), { value: '', label: '' }] })} 
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
                                          next[i].value = e.target.value;
                                          handleUpdate(name, { options: next });
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
                                           next[i].label = e.target.value;
                                           handleUpdate(name, { options: next });
                                         }}
                                         placeholder="Display Text"
                                      />
                                    </td>
                                    <td className="p-1 px-4 text-center">
                                      <button 
                                        onClick={() => handleUpdate(name, { options: (os.options || []).filter((_, idx) => idx !== i) })} 
                                        className="opacity-0 group-hover:opacity-100 text-muted hover:text-error transition-all"
                                      >✕</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                           </table>
                           {(!os.options || os.options.length === 0) && (
                              <div className="py-6 text-center text-[12px] text-muted italic">No options defined.</div>
                           )}
                         </div>
                      </section>
                    ) : (
                      <section className="space-y-4">
                         <div className="space-y-1.5">
                           <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Source Endpoint</label>
                           <InlineExpression 
                              value={os.source || ''} 
                              onSave={(val) => handleUpdate(name, { source: val })}
                              placeholder="https://api.example.com/options"
                              className="w-full"
                           />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Value Path</label>
                              <input 
                                className="w-full bg-subtle border border-border rounded px-2 py-1.5 font-mono text-[11px] outline-none focus:ring-1 focus:ring-accent" 
                                value={os.valueField || 'value'}
                                onChange={(e) => handleUpdate(name, { valueField: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Label Path</label>
                              <input 
                                className="w-full bg-subtle border border-border rounded px-2 py-1.5 font-mono text-[11px] outline-none focus:ring-1 focus:ring-accent" 
                                value={os.labelField || 'label'}
                                onChange={(e) => handleUpdate(name, { labelField: e.target.value })}
                              />
                            </div>
                         </div>
                      </section>
                    )}

                    <div className="pt-4 border-t border-border flex justify-end">
                      <button 
                        onClick={() => handleDelete(name)}
                        className="text-[10px] font-bold text-muted hover:text-error uppercase tracking-widest transition-colors"
                      >
                        Delete Table
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
