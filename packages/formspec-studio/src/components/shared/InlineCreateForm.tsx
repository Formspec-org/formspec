/** @filedesc Reusable inline create form with accent border, input area, and Cancel/Create actions. */
import type React from 'react';

interface InlineCreateFormProps {
  children: React.ReactNode;
  example?: React.ReactNode;
  onCancel: () => void;
  onCreate: () => void;
  createLabel?: string;
  canCreate?: boolean;
}

export function InlineCreateForm({
  children,
  example,
  onCancel,
  onCreate,
  createLabel = 'Create',
  canCreate = true,
}: InlineCreateFormProps) {
  return (
    <div className="border border-accent/30 rounded-xl bg-accent/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
      {children}
      {example && (
        <p className="text-[11px] text-muted">{example}</p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] uppercase font-bold text-muted hover:text-ink transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={!canCreate}
          className="text-[10px] uppercase font-bold text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
        >
          {createLabel}
        </button>
      </div>
    </div>
  );
}
