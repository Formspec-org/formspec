/** @filedesc Logic tab section for creating and editing named FEL variable expressions. */
import { useState } from 'react';
import { useProject } from '../../state/useProject';
import { InlineExpression } from '../../components/ui/InlineExpression';
import { InlineCreateForm } from '../../components/shared/InlineCreateForm';

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
        <InlineCreateForm
          onCancel={() => setIsAdding(false)}
          onCreate={handleAdd}
        >
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
        </InlineCreateForm>
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
                className="inline-flex items-center gap-1.5 text-[15px] font-bold text-accent cursor-pointer hover:text-accent-hover transition-colors group/vn"
                onClick={() => setEditingName(v.name)}
              >
                @{v.name}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-3 h-3 flex-shrink-0 opacity-30 group-hover/vn:opacity-70 transition-opacity"
                  aria-hidden="true"
                >
                  <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z" />
                </svg>
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
