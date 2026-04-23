/** @filedesc Logic tab section for creating and editing cross-field shape validation rules. */
import { useState } from 'react';
import { useProject } from '../../state/useProject';
import { ShapeCard } from '../../components/ui/ShapeCard';
import { InlineExpression } from '../../components/ui/InlineExpression';

import { InlineCreateForm } from '../../components/shared/InlineCreateForm';

interface Shape {
  id?: string;
  name: string;
  severity: string;
  constraint?: string;
  target?: string;
  and?: string[];
  or?: string[];
  targets?: string[];
  message?: string;
  code?: string;
}

interface ShapesSectionProps {
  shapes: Shape[];
}

export function ShapesSection({ shapes }: ShapesSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newId, setNewId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const project = useProject();

  const handleAdd = () => {
    if (!newId.trim()) return;
    const id = newId.trim();
    project.addValidation(id, 'true', 'Validation failed', { severity: 'error' });
    setExpandedId(id);
    setNewId('');
    setIsAdding(false);
  };

  const handleSetProperty = (id: string, property: string, value: unknown) => {
    if (property === 'constraint') {
      project.updateValidation(id, { rule: value as string });
    } else {
      project.updateValidation(id, { [property]: value } as Parameters<typeof project.updateValidation>[1]);
    }
  };

  const handleDelete = (id: string) => {
    project.removeValidation(id);
    if (expandedId === id) setExpandedId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Validation Rules</h4>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-[11px] text-logic hover:text-logic-hover font-bold uppercase tracking-wider transition-colors"
          >
            + New Shape
          </button>
        )}
      </div>

      {/* Inline add form */}
      {isAdding && (
        <InlineCreateForm
          accentColor="logic"
          onCancel={() => setIsAdding(false)}
          onCreate={handleAdd}
        >
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              placeholder="shape_id (e.g. valid_revenue)"
              value={newId}
              onChange={(e) => setNewId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-ink placeholder:text-muted/40"
            />
          </div>
        </InlineCreateForm>
      )}

      {shapes.length === 0 && !isAdding && (
        <div className="py-2 text-xs text-muted italic">No validation shapes defined.</div>
      )}

      {shapes.map((shape) => {
        const id = shape.id || shape.name;
        const constraint = shape.constraint
          ?? (Array.isArray(shape.or) ? shape.or.join(' or ') : undefined)
          ?? (Array.isArray(shape.and) ? shape.and.join(' and ') : '');
        const isExpanded = expandedId === id;

        return (
          <div key={id}>
            <div
              className="cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
              onClick={() => setExpandedId(isExpanded ? null : id)}
            >
              <ShapeCard
                name={shape.name}
                severity={shape.severity}
                constraint={constraint}
                message={shape.message}
                code={shape.code}
              />
            </div>

            {isExpanded && (
              <div className="border border-border border-t-0 rounded-b-[4px] bg-surface p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                    Constraint
                  </label>
                  <InlineExpression
                    value={constraint}
                    onSave={(val) => handleSetProperty(id, 'constraint', val)}
                    placeholder="Click to add constraint expression"
                  />
                </div>

                <div>
                  <label htmlFor={`severity-${id}`} className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                    Severity
                  </label>
                  <select
                    id={`severity-${id}`}
                    value={shape.severity}
                    onChange={(e) => handleSetProperty(id, 'severity', e.target.value)}
                    className="bg-subtle border border-border rounded px-2 py-1 text-[11px] font-mono text-ink outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="error">error</option>
                    <option value="warning">warning</option>
                    <option value="info">info</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`message-${id}`} className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                    Message
                  </label>
                  <input
                    id={`message-${id}`}
                    type="text"
                    defaultValue={shape.message || ''}
                    onBlur={(e) => handleSetProperty(id, 'message', e.target.value)}
                    className="w-full bg-subtle border border-border rounded px-2 py-1 text-[11px] text-ink outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label htmlFor={`code-${id}`} className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                    Code
                  </label>
                  <input
                    id={`code-${id}`}
                    type="text"
                    defaultValue={shape.code || ''}
                    onBlur={(e) => handleSetProperty(id, 'code', e.target.value)}
                    className="w-full bg-subtle border border-border rounded px-2 py-1 text-[11px] font-mono text-ink outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label htmlFor={`target-${id}`} className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                    Target
                  </label>
                  <input
                    id={`target-${id}`}
                    type="text"
                    defaultValue={shape.target || '*'}
                    onBlur={(e) => handleSetProperty(id, 'target', e.target.value)}
                    className="w-full bg-subtle border border-border rounded px-2 py-1 text-[11px] font-mono text-ink outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    aria-label="Delete shape"
                    onClick={() => handleDelete(id)}
                    className="text-[10px] text-muted hover:text-error font-bold uppercase tracking-wider transition-colors"
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
