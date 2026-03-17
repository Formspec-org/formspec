/** @filedesc Logic tab section for creating and editing named FEL variable expressions. */
import { useState } from 'react';
import { useProject } from '../../state/useProject';
import { InlineExpression } from '../../components/ui/InlineExpression';

interface Variable {
  name: string;
  expression: string;
}

interface VariablesSectionProps {
  variables: Variable[];
}

export function VariablesSection({ variables }: VariablesSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const project = useProject();

  const handleAdd = () => {
    if (!newName.trim()) return;
    project.addVariable(newName.trim(), 'null');
    setNewName('');
    setIsAdding(false);
  };

  const handleNameSave = (oldName: string, newValue: string) => {
    setEditingName(null);
    const trimmed = newValue.replace(/[^a-zA-Z0-9_]/g, '');
    if (!trimmed || trimmed === oldName) return;
    project.renameVariable(oldName, trimmed);
  };

  const handleExpressionSave = (name: string, newValue: string) => {
    project.updateVariable(name, newValue);
  };

  const handleDelete = (name: string) => {
    project.removeVariable(name);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Active Values</h4>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
          >
            + New Variable
          </button>
        )}
      </div>

      {isAdding && (
        <div className="border border-accent/30 rounded-lg bg-accent/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-accent font-mono text-sm leading-none pt-0.5">@</span>
            <input
              autoFocus
              type="text"
              placeholder="variable_name"
              value={newName}
              onChange={(e) => setNewName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-ink placeholder:text-muted/40"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="text-[10px] uppercase font-bold text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="text-[10px] uppercase font-bold text-accent hover:text-accent-hover transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {variables.length === 0 && !isAdding && (
        <div className="py-2 text-xs text-muted italic">No variables defined. Click &quot;+ New Variable&quot; to start.</div>
      )}

      {variables.map((v) => (
        <div
          key={v.name}
          className="border border-border rounded-lg bg-surface p-3 transition-all hover:border-accent/50 group"
        >
          <div className="flex items-center justify-between mb-1.5">
            {editingName === v.name ? (
              <div className="flex items-center gap-1">
                <span className="text-accent font-mono text-[15px] font-bold">@</span>
                <input
                  autoFocus
                  type="text"
                  defaultValue={v.name}
                  onBlur={(e) => handleNameSave(v.name, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingName(null);
                  }}
                  className="bg-transparent border-b border-accent outline-none text-[15px] font-bold font-mono text-accent"
                />
              </div>
            ) : (
              <div
                className="text-[15px] font-bold text-accent cursor-pointer hover:text-accent-hover transition-colors"
                onClick={() => setEditingName(v.name)}
              >
                @{v.name}
              </div>
            )}
            <button
              type="button"
              aria-label="Delete variable"
              onClick={() => handleDelete(v.name)}
              className="text-[10px] text-muted hover:text-error font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all"
            >
              Delete
            </button>
          </div>
          <InlineExpression
            value={v.expression}
            onSave={(val) => handleExpressionSave(v.name, val)}
            placeholder="Click to add expression"
          />
        </div>
      ))}
    </div>
  );
}
