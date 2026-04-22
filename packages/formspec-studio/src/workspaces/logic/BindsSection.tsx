/** @filedesc Logic tab section listing all bind entries (required, relevant, calculate, etc.) with FEL editors. */
import { BindCard } from '../../components/ui/BindCard';
import { InlineExpression } from '../../components/ui/InlineExpression';
import { useProject } from '../../state/useProject';
import { AddBehaviorMenu } from '../../components/ui/AddBehaviorMenu';
import { PrePopulateCard } from '../../components/ui/PrePopulateCard';
import { useState, useMemo } from 'react';
import { type BindEntry, bindTypes } from './bind-types';

interface BindsSectionProps {
  binds: Record<string, BindEntry>;
  activeFilter?: (typeof bindTypes)[number] | null;
  allPaths?: string[];
  onSelectPath?: (path: string) => void;
}

export function BindsSection({ binds, activeFilter = null, allPaths = [], onSelectPath }: BindsSectionProps) {
  const project = useProject();

  const [isAddingPath, setIsAddingPath] = useState(false);

  const entries = Object.entries(binds).filter(([, bind]) => {
    if (!activeFilter) return true;
    return Boolean(bind[activeFilter]);
  });

  const pathsWithoutBinds = useMemo(() => {
    const existing = new Set(Object.keys(binds));
    return allPaths.filter(p => !existing.has(p)).sort();
  }, [allPaths, binds]);

  const [pendingPath, setPendingPath] = useState<string | null>(null);

  if (entries.length === 0 && pathsWithoutBinds.length === 0) return null;

  const handleSave = (path: string, type: string, newValue: any) => {
    if (type === 'pre-populate') {
      project.updateItem(path, { prePopulate: newValue ?? null });
    } else {
      project.updateItem(path, { [type]: newValue ?? null });
    }
  };

  const handleAddWithInitialType = (path: string, type: string) => {
    if (type === 'pre-populate') {
      handleSave(path, type, { instance: '', path: '' });
    } else {
      const initialValue = type === 'calculate' ? '' : 'true';
      handleSave(path, type, initialValue);
    }
    setPendingPath(null);
    setIsAddingPath(false);
    onSelectPath?.(path);
  };

  return (
    <div className="space-y-4">
      {/* ... entries map ... */}
      {entries.map(([path, bind]) => (
        <div key={path} className="space-y-1.5">
          <button
            type="button"
            onClick={() => onSelectPath?.(path)}
            className="text-[14px] font-bold text-ink hover:text-accent font-mono transition-colors"
          >
            {path}
          </button>
          <div className="space-y-1.5 pl-3 border-l border-border/50 ml-1">
            {bindTypes.map((type) => {
              const expression = bind[type];
              if (expression === null || expression === undefined) return null;

              if (type === 'pre-populate') {
                return (
                  <PrePopulateCard
                    key={type}
                    value={expression}
                    onChange={(val) => handleSave(path, type, val)}
                    onRemove={() => handleSave(path, type, null)}
                    itemKey={path.split('.').pop()}
                  />
                );
              }

              return (
                <BindCard
                  key={type}
                  bindType={type}
                  expression={expression}
                  onRemove={() => handleSave(path, type, null)}
                >
                  <InlineExpression
                    value={expression}
                    onSave={(val) => handleSave(path, type, val)}
                    placeholder="Click to add expression"
                  />
                </BindCard>
              );
            })}
            <AddBehaviorMenu
              existingTypes={bindTypes.filter(type => bind[type] !== null && bind[type] !== undefined)}
              onAdd={(type) => handleAddWithInitialType(path, type)}
              className="mt-2 ml-1"
            />
          </div>
        </div>
      ))}

      {pathsWithoutBinds.length > 0 && (
        <div className="pt-4 border-t border-border/40 mt-8">
          {!isAddingPath ? (
            <button
              onClick={() => setIsAddingPath(true)}
              className="text-[12px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
            >
              <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-[16px] leading-none pb-0.5">+</div>
              Add Logic to Field
            </button>
          ) : (
            <div className="bg-subtle/30 rounded-lg p-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider">
                  {pendingPath ? `Add Behavior to ${pendingPath}` : 'Select Field'}
                </h4>
                <button
                  onClick={() => {
                    setIsAddingPath(false);
                    setPendingPath(null);
                  }}
                  className="text-[10px] text-muted hover:text-ink font-bold uppercase"
                >
                  Cancel
                </button>
              </div>

              {!pendingPath ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {pathsWithoutBinds.map(p => (
                    <button
                      key={p}
                      onClick={() => setPendingPath(p)}
                      className="text-left px-3 py-2 text-[13px] font-mono text-ink bg-surface border border-border rounded-[6px] hover:border-accent hover:text-accent transition-all truncate"
                      title={p}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {bindTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => handleAddWithInitialType(pendingPath, type)}
                      className="text-left px-3 py-2 rounded-[6px] border border-border bg-surface hover:border-accent group transition-all"
                    >
                      <div className="text-[11px] font-bold text-ink group-hover:text-accent uppercase tracking-wider">
                        {type}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
