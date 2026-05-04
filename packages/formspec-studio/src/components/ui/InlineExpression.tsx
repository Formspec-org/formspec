/** @filedesc Click-to-edit inline FEL expression widget that toggles between display and FELEditor modes. */
import { useMemo, useState } from 'react';
import {
  IconEdit,
  IconWarning,
} from '../icons';
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

const TOKEN_CLASS: Record<FELHighlightToken['kind'], string> = {
  keyword: 'text-accent font-bold',
  path: 'text-green',
  function: 'text-logic font-semibold',
  literal: 'text-amber',
  operator: 'text-muted',
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

export function InlineExpression({
  value,
  onSave,
  placeholder = 'Click to edit',
  className,
  autoEdit = false,
  expressionType = 'default',
  itemKey,
}: InlineExpressionProps) {
  const [editing, setEditing] = useState(autoEdit);

  const enterEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(true);
  };

  const handleSave = (val: string) => {
    setEditing(false);
    onSave(val);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const isWhenExpression = expressionType === 'when';

  if (editing) {
    return (
      <div className="relative">
        <FELEditor
          value={value}
          onSave={handleSave}
          onCancel={handleCancel}
          autoFocus
          expressionType={expressionType}
          itemKey={itemKey}
        />
        <div className="absolute right-2 top-2">
          <FELReferencePopup />
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <button
        type="button"
        onClick={enterEdit}
        className={`inline-flex items-center gap-1 font-mono text-[11px] text-muted italic cursor-pointer hover:text-muted transition-colors group/ie ${className ?? ''}`}
      >
        {placeholder}
        <IconEdit size={10} className="opacity-30 group-hover/ie:opacity-60" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={enterEdit}
      title={value}
      className={`inline-flex items-center gap-1.5 font-mono text-[12px] bg-subtle/40 border border-border/40 rounded px-2 py-1 text-ink group/ie hover:border-accent/40 transition-all ${className ?? ''}`}
    >
      <span className="max-w-[120px] overflow-hidden text-ellipsis">
        <HighlightedExpression expression={value} />
      </span>
      {isWhenExpression && value && (
        <span title="This hides the component only. Use relevant in Editor to control data.">
          <IconWarning size={10} className="text-warning/70" />
        </span>
      )}
      <IconEdit size={10} className="opacity-30 group-hover/ie:opacity-60" />
    </button>
  );
}
