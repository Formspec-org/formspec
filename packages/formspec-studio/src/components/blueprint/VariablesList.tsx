import { useDefinition } from '../../state/useDefinition';
import { useState } from 'react';
import { LogicEditorDialog } from '../../workspaces/logic/LogicEditorDialog';

export function VariablesList() {
  const definition = useDefinition();
  const variables = definition.variables ?? [];
  const [editingVariable, setEditingVariable] = useState<{ name: string; expression: string } | null>(null);

  const displayExpression = (expression: string) => expression.replace(/@([A-Za-z_]\w*)/g, '$1');

  if (variables.length === 0) {
    return <p className="text-xs text-muted py-2">No variables defined</p>;
  }

  return (
    <>
      <div className="space-y-1">
        {variables.map((v) => (
          <button
            key={v.name}
            type="button"
            onClick={() => setEditingVariable(v)}
            className="w-full rounded-[4px] px-2 py-1 text-left transition-colors hover:bg-subtle group"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-mono text-accent">@{v.name}</div>
              <div className="text-[9px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">Edit</div>
            </div>
            <div className="text-xs font-mono text-muted truncate" title={v.expression}>
              {displayExpression(v.expression)}
            </div>
          </button>
        ))}
      </div>

      <LogicEditorDialog
        open={!!editingVariable}
        onClose={() => setEditingVariable(null)}
        target={editingVariable ? { type: 'variable', nameOrPath: editingVariable.name, expression: editingVariable.expression } : null}
      />
    </>
  );
}
