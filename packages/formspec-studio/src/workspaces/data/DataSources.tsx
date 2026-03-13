import { useState } from 'react';
import { useDispatch } from '../../state/useDispatch';
import { useDefinition } from '../../state/useDefinition';
import { InlineExpression } from '../../components/ui/InlineExpression';

interface Instance {
  name: string;
  source?: string;
  data?: any;
  description?: string;
  schema?: Record<string, string>;
  static?: boolean;
}

interface DataSourcesProps {
  onEdit?: (name: string, inst: Instance) => void;
}

export function DataSources({}: DataSourcesProps) {
  const definition = useDefinition();
  const dispatch = useDispatch();
  const rawInstances = definition?.instances;
  const [expandedName, setExpandedName] = useState<string | null>(null);

  const instances: Instance[] = Array.isArray(rawInstances)
    ? rawInstances
    : Object.entries(rawInstances || {}).map(([name, inst]) => ({
        name,
        ...(inst as object),
      }));

  const handleAddDataSource = () => {
    const name = window.prompt('Data source name (e.g. patient_record)');
    if (!name?.trim()) return;
    dispatch({
      type: 'definition.addInstance',
      payload: { name: name.trim() },
    });
    setExpandedName(name.trim());
  };

  const handleUpdate = (name: string, payload: Partial<Instance>) => {
    dispatch({
      type: 'definition.setInstance',
      payload: { name, ...payload },
    });
  };

  const handleDelete = (name: string) => {
    if (window.confirm(`Delete data source "${name}"? This will break FEL expressions referencing it.`)) {
      dispatch({
        type: 'definition.deleteInstance',
        payload: { name },
      });
      if (expandedName === name) setExpandedName(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h4 className="text-[11px] font-bold text-muted uppercase tracking-[0.2em]">External Data Catalog</h4>
          <p className="text-[11px] text-muted italic mt-1">Reference these in FEL using @instance('name')</p>
        </div>
        <button
          type="button"
          onClick={handleAddDataSource}
          className="px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent hover:text-white text-[11px] font-bold uppercase tracking-wider rounded-md transition-all border border-accent/20"
        >
          + Add Document
        </button>
      </div>

      {instances.length === 0 && (
        <div className="py-12 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center opacity-40">
           <div className="text-2xl mb-2">⎗</div>
           <p className="text-sm font-medium">No external sources connected.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {instances.map((inst) => {
          const isExpanded = expandedName === inst.name;
          const schema = inst.schema || {};

          return (
            <div 
              key={inst.name}
              className={`group relative bg-surface border rounded-xl shadow-sm transition-all overflow-hidden ${isExpanded ? 'border-accent ring-1 ring-accent/10' : 'border-border'}`}
            >
              {/* Folder-tab style header */}
              <div 
                className="flex items-center justify-between px-4 py-2 border-b border-border bg-subtle/30 cursor-pointer"
                onClick={() => setExpandedName(isExpanded ? null : inst.name)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono font-bold bg-ink text-white px-2 py-0.5 rounded uppercase tracking-wider">
                    @instance('{inst.name}')
                  </span>
                  {inst.static && (
                    <span className="text-[9px] font-bold text-muted uppercase tracking-tighter border border-border px-1.5 rounded">Static</span>
                  )}
                </div>
                <div className={`text-[12px] text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</div>
              </div>

              {!isExpanded ? (
                <div className="p-5 flex gap-8">
                  {/* Metadata Panel */}
                  <div className="w-1/3 space-y-4">
                    <div>
                       <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">Source Connection</label>
                       {inst.source ? (
                          <div className="text-[12px] font-mono text-ink break-all bg-subtle p-2 rounded border border-border/50">
                            {inst.source}
                          </div>
                       ) : (
                          <div className="text-[12px] text-muted italic">Inline Document</div>
                       )}
                    </div>
                  </div>

                  {/* Structure Preview */}
                  <div className="flex-1">
                     <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">Data Blueprint</label>
                     <div className="bg-ink/[0.03] border border-border rounded-lg p-3 font-mono text-[12px] min-h-[60px]">
                        {Object.keys(schema).length > 0 ? (
                          <div className="space-y-1">
                            {Object.entries(schema).map(([key, type]) => (
                              <div key={key}>
                                <span className="text-orange-600">"{key}"</span><span className="text-muted">:</span> <span className="text-blue-600">"{type as string}"</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted/40 italic flex items-center justify-center h-full">
                            No blueprint data available.
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-8 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="grid grid-cols-2 gap-8">
                    {/* Left: Connection Settings */}
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest block">Connection Endpoint</label>
                        <InlineExpression 
                          value={inst.source || ''} 
                          onSave={(val) => handleUpdate(inst.name, { source: val })}
                          placeholder="https://api.example.com/data/{{id}}"
                          className="w-full"
                        />
                        <p className="text-[10px] text-muted italic">Supports {"{{"}handlebar{"}}"} injection.</p>
                      </div>

                      <div className="space-y-3">
                         <label className="text-[10px] font-bold text-muted uppercase tracking-widest block mb-1">Execution Policy</label>
                         <div className="space-y-2">
                           <label className="flex items-center gap-3 cursor-pointer group">
                             <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                              checked={inst.static}
                              onChange={(e) => handleUpdate(inst.name, { static: e.target.checked })}
                             />
                             <span className="text-[12px] font-bold text-ink">Static (Caching)</span>
                           </label>
                         </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest block">Description</label>
                        <textarea 
                          className="w-full bg-subtle border border-border rounded p-2 text-[12px] outline-none focus:ring-1 focus:ring-accent h-20"
                          value={inst.description || ''}
                          onChange={(e) => handleUpdate(inst.name, { description: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Right: Blueprint Designer */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest block">Blueprint Designer</label>
                        <button 
                          onClick={() => handleUpdate(inst.name, { schema: { ...schema, "new_field": "string" } })}
                          className="text-[10px] font-bold text-accent hover:underline"
                        >
                          + Add Field
                        </button>
                      </div>
                      <div className="bg-subtle/50 border border-border rounded-lg overflow-hidden">
                         <table className="w-full text-left border-collapse">
                            <thead className="bg-subtle text-[9px] font-bold text-muted uppercase tracking-widest border-b border-border">
                              <tr>
                                <th className="py-2 px-3">Key</th>
                                <th className="py-2 px-3">Type</th>
                                <th className="w-8"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                              {Object.entries(schema).map(([key, type]) => (
                                <tr key={key} className="hover:bg-subtle/30 group">
                                  <td className="p-1 px-3">
                                    <input 
                                      className="w-full bg-transparent border-none focus:ring-0 font-mono text-[11px]" 
                                      value={key} 
                                      onChange={(e) => {
                                        const next = { ...schema };
                                        delete next[key];
                                        next[e.target.value] = type;
                                        handleUpdate(inst.name, { schema: next });
                                      }}
                                    />
                                  </td>
                                  <td className="p-1 px-3">
                                    <select 
                                      className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-muted uppercase tracking-tight"
                                      value={type}
                                      onChange={(e) => {
                                        const next = { ...schema };
                                        next[key] = e.target.value;
                                        handleUpdate(inst.name, { schema: next });
                                      }}
                                    >
                                      <option value="string">String</option>
                                      <option value="decimal">Decimal</option>
                                      <option value="integer">Integer</option>
                                      <option value="boolean">Boolean</option>
                                      <option value="date">Date</option>
                                    </select>
                                  </td>
                                  <td className="p-1 px-3 text-center">
                                    <button 
                                      onClick={() => {
                                        const next = { ...schema };
                                        delete next[key];
                                        handleUpdate(inst.name, { schema: next });
                                      }} 
                                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-error transition-all"
                                    >✕</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                         </table>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border flex justify-end">
                    <button 
                      onClick={() => handleDelete(inst.name)}
                      className="text-[10px] font-bold text-muted hover:text-error uppercase tracking-widest transition-colors"
                    >
                      Delete Document
                    </button>
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
