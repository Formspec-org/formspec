/** @filedesc Click-to-edit inline FEL expression widget that toggles between display and FELEditor modes. */
import { useMemo, useState } from 'react';
import { buildFELHighlightTokens, type FELHighlightToken } from '@formspec-org/studio-core';
import { FELReferencePopup } from './FELReferencePopup';
import { FELEditor } from './FELEditor';

interface InlineExpressionProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  className?: string;
  /** Start in edit mode immediately (e.g. when the bind was just created). */
  autoEdit?: boolean;
  /** Type of expression being edited — determines if rendering-only callout should appear. */
  expressionType?: 'when' | 'calculate' | 'default';
  /** For 'when' expressions: the item key being configured, to enable Editor navigation. */
  itemKey?: string;
}

function EditPencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`w-2.5 h-2.5 flex-shrink-0 transition-opacity ${className ?? ''}`}
      aria-hidden="true"
    >
      <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z" />
    </svg>
  );
}

function WhenWarningIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`w-2.5 h-2.5 flex-shrink-0 transition-opacity ${className ?? ''}`}
      aria-hidden="true"
    >
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7 4h2v5H7V4zm0 6h2v2H7v-2z" />
    </svg>
  );
}

const TOKEN_CLASS: Record<FELHighlightToken['kind'], string> = {
  keyword: 'text-accent font-bold',
  path: 'text-green',
  function: 'text-logic font-semibold',
  literal: 'text-amber',
  operator: 'text-muted/60',
  plain: 'text-ink/70',
};

export function HighlightedExpression({ expression }: { expression: string }) {
  const tokens = useMemo(() => buildFELHighlightTokens(expression), [expression]);
  return (
    <>
      {tokens.map((token, i) => (
        <span key={`${token.key}-${i}`} className={TOKEN_CLASS[token.kind]}>
          {token.text}
        </span>
      ))}
    </>
  );
}

export function InlineExpression({ value, onSave, placeholder, className, autoEdit, expressionType, itemKey }: InlineExpressionProps) {
  const [editing, setEditing] = useState(Boolean(autoEdit));
  const [draft, setDraft] = useState(value);

  function enterEdit() {
    setDraft(value);
    setEditing(true);
  }

  function saveWith(val: string) {
    setEditing(false);
    // Always fire onSave when empty (so the caller can delete the bind)
    // or when the value actually changed.
    if (val !== value || !val.trim()) {
      onSave(val);
    }
  }

  function cancel() {
    setEditing(false);
  }

  const isWhenExpression = expressionType === 'when';

  if (editing) {
    return (
      <div data-fel-editor-root className={`flex items-start gap-1 ${className ?? ''}`}>
        <FELEditor
          value={draft}
          onSave={saveWith}
          onCancel={cancel}
          placeholder={placeholder}
          className="flex-1"
          autoFocus
          expressionType={expressionType}
          itemKey={itemKey}
        />
        <FELReferencePopup />
      </div>
    );
  }

  if (!value && placeholder) {
    return (
      <button
        type="button"
        onClick={enterEdit}
        className={`inline-flex items-center gap-1 font-mono text-[11px] text-muted/50 italic cursor-pointer hover:text-muted transition-colors group/ie ${className ?? ''}`}
      >
        {placeholder}
        <EditPencilIcon className="opacity-30 group-hover/ie:opacity-60" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={enterEdit}
      className={`inline-flex items-center gap-1 font-mono text-[11px] bg-subtle border border-border/60 px-1.5 py-0.5 rounded-[2px] cursor-pointer hover:bg-subtle/80 transition-colors group/ie text-left ${className ?? ''}`}
      title={value}
    >
      <span className="max-w-[120px] overflow-hidden text-ellipsis">
        <HighlightedExpression expression={value} />
      </span>
      {isWhenExpression && value && (
        <span title="This hides the component only. Use relevant in Editor to control data.">
          <WhenWarningIcon className="text-warning/70" />
        </span>
      )}
      <EditPencilIcon className="opacity-30 group-hover/ie:opacity-60" />
    </button>
  );
}
