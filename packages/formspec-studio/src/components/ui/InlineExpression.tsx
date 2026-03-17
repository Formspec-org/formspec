/** @filedesc Click-to-edit inline FEL expression widget that toggles between display and FELEditor modes. */
import { useEffect, useRef, useState } from 'react';
import { FELReferencePopup } from './FELReferencePopup';
import { FELEditor } from './FELEditor';

interface InlineExpressionProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  className?: string;
}

export function InlineExpression({ value, onSave, placeholder, className }: InlineExpressionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    // FELEditor handles its own focus and resize
  }, [editing]);

  function enterEdit() {
    setDraft(value);
    setEditing(true);
  }

  function save() {
    saveWith(draft);
  }

  function saveWith(val: string) {
    setEditing(false);
    if (val !== value) {
      onSave(val);
    }
  }

  function cancel() {
    setEditing(false);
  }


  if (editing) {
    return (
      <div className={`flex items-start gap-1 ${className ?? ''}`}>
        <FELEditor
          value={draft}
          onSave={saveWith}
          onCancel={cancel}
          placeholder={placeholder}
          className="flex-1"
          autoFocus
        />
        <FELReferencePopup />
      </div>
    );
  }

  if (!value && placeholder) {
    return (
      <span
        onClick={enterEdit}
        className={`font-mono text-[11px] text-muted/50 italic cursor-pointer hover:text-muted transition-colors ${className ?? ''}`}
      >
        {placeholder}
      </span>
    );
  }

  return (
    <span
      onClick={enterEdit}
      className={`font-mono text-[11px] text-muted bg-subtle px-1.5 py-0.5 rounded-[2px] cursor-pointer hover:bg-subtle/80 hover:text-ink transition-colors ${className ?? ''}`}
      title={value}
    >
      {value}
    </span>
  );
}
