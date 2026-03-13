import { useState } from 'react';
import { useDispatch } from '../../state/useDispatch';
import { ShapeCard } from '../../components/ui/ShapeCard';

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
  onEditShape?: (shape: Shape) => void;
}

export function ShapesSection({ shapes, onEditShape }: ShapesSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newId, setNewId] = useState('');
  const dispatch = useDispatch();

  const handleAdd = () => {
    if (!newId.trim()) return;
    dispatch({
      type: 'definition.addShape',
      payload: { 
        id: newId.trim(), 
        target: '*', 
        constraint: '',
        message: 'Validation failed',
        severity: 'error'
      },
    });
    onEditShape?.({ 
      id: newId.trim(), 
      name: newId.trim(), 
      severity: 'error', 
      constraint: '',
      message: 'Validation failed'
    });
    setNewId('');
    setIsAdding(false);
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

      {isAdding && (
        <div className="border border-logic/30 rounded-lg bg-logic/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
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
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="text-[10px] uppercase font-bold text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="text-[10px] uppercase font-bold text-logic hover:text-logic-hover transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {shapes.length === 0 && !isAdding && (
        <div className="py-2 text-xs text-muted italic">No validation shapes defined.</div>
      )}
      {shapes.map((shape) => {
        const constraint = shape.constraint
          ?? (Array.isArray(shape.or) ? shape.or.join(' or ') : undefined)
          ?? (Array.isArray(shape.and) ? shape.and.join(' and ') : '');

        return (
          <button
            key={shape.id || shape.name}
            type="button"
            className="w-full text-left bg-transparent border-none p-0 focus:outline-none focus:ring-1 focus:ring-accent rounded transition-all hover:scale-[1.01] active:scale-[0.99]"
            onClick={() => onEditShape?.(shape)}
          >
            <ShapeCard
              name={shape.name}
              severity={shape.severity}
              constraint={constraint}
              message={shape.message}
              code={shape.code}
            />
          </button>
        );
      })}
    </div>
  );
}
