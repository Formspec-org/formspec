import { useState, useEffect } from 'react';
import { useDispatch } from '../../state/useDispatch';
import { FELReferencePopup } from '../../components/ui/FELReferencePopup';

interface LogicEditorDialogProps {
  open: boolean;
  onClose: () => void;
  target: {
    type: 'variable' | 'bind' | 'shape';
    nameOrPath: string;
    bindType?: string;
    expression: string;
  } | null;
}

export function LogicEditorDialog({ open, onClose, target }: LogicEditorDialogProps) {
  const dispatch = useDispatch();
  const [expression, setExpression] = useState('');

  useEffect(() => {
    if (target) {
      setExpression(target.expression);
    }
  }, [target]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        handleSave();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, expression]);

  if (!open || !target) return null;

  const handleSave = () => {
    if (target.type === 'variable') {
      dispatch({
        type: 'definition.setVariable',
        payload: { name: target.nameOrPath, property: 'expression', value: expression },
      });
    } else if (target.type === 'shape') {
      dispatch({
        type: 'definition.setShapeProperty',
        payload: { id: target.nameOrPath, property: 'constraint', value: expression },
      });
    } else {
      dispatch({
        type: 'definition.setBind',
        payload: {
          path: target.nameOrPath,
          properties: { [target.bindType!]: expression || null },
        },
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    
    if (target.type === 'variable') {
      dispatch({
        type: 'definition.deleteVariable',
        payload: { name: target.nameOrPath },
      });
    } else if (target.type === 'shape') {
      dispatch({
        type: 'definition.deleteShape',
        payload: { id: target.nameOrPath },
      });
    } else {
      dispatch({
        type: 'definition.setBind',
        payload: {
          path: target.nameOrPath,
          properties: { [target.bindType!]: null },
        },
      });
    }
    onClose();
  };

  const title = target.type === 'variable' 
    ? `Variable: @${target.nameOrPath}`
    : target.type === 'shape'
      ? `Validation Rule: ${target.nameOrPath}`
      : `Behavior: ${target.bindType} for ${target.nameOrPath}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-subtle/30">
          <div className="flex flex-col">
            <h2 className="text-[17px] font-bold text-ink">{title}</h2>
            <div className="text-[12px] text-muted font-mono mt-0.5">
              {target.type === 'variable' ? 'Form-level calculated value' : target.type === 'shape' ? 'Cross-field validation logic' : `Field-level ${target.bindType} rule`}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-subtle text-muted hover:text-ink transition-colors"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="logic-expression" className="font-mono text-[11px] text-muted uppercase tracking-wider">
                FEL Expression
              </label>
              <FELReferencePopup />
            </div>
            <textarea
              id="logic-expression"
              autoFocus
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="e.g. if(total > 100, true, false)"
              className="w-full h-40 rounded-lg border border-border bg-bg-default px-4 py-3 text-[14px] font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all resize-none shadow-inner"
            />
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-1 opacity-70">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-subtle text-[10px] font-sans">⌘</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-subtle text-[10px] font-sans">Enter</kbd>
              <span>to save</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-subtle/10 flex items-center justify-between">
          <button
            type="button"
            className="px-4 py-2 text-[13px] font-medium rounded-lg text-error hover:bg-error/5 transition-colors"
            onClick={handleDelete}
          >
            Delete
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-4 py-2 text-[13px] font-medium rounded-lg border border-border text-ink hover:bg-subtle transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-5 py-2 text-[13px] font-bold rounded-lg bg-accent text-white hover:bg-accent-hover shadow-sm shadow-accent/20 transition-all"
              onClick={handleSave}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
