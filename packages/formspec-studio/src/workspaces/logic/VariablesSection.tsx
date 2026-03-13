import { useState } from 'react';
import { useDispatch } from '../../state/useDispatch';

interface Variable {
  name: string;
  expression: string;
}

interface VariablesSectionProps {
  variables: Variable[];
  onEditVariable?: (v: Variable) => void;
}

export function VariablesSection({ variables, onEditVariable }: VariablesSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const dispatch = useDispatch();

  const handleAdd = () => {
    if (!newName.trim()) return;
    dispatch({
      type: 'definition.addVariable',
      payload: { name: newName.trim(), expression: '' },
    });
    onEditVariable?.({ name: newName.trim(), expression: '' });
    setNewName('');
    setIsAdding(false);
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
        <div className="py-2 text-xs text-muted italic">No variables defined. Click "+ New Variable" to start.</div>
      )}

      {variables.map((v) => (
        <button
          key={v.name}
          type="button"
          onClick={() => onEditVariable?.(v)}
          className="w-full text-left border border-border rounded-lg bg-surface p-3 transition-all hover:border-accent hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-accent group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[15px] font-bold text-accent group-hover:text-accent-hover transition-colors">@{v.name}</div>
            <div className="text-[10px] text-muted font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Edit</div>
          </div>
          <div className="text-xs font-mono text-muted bg-subtle px-2 py-1.5 rounded truncate border border-border/50">{v.expression}</div>
        </button>
      ))}
    </div>
  );
}
