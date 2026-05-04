import React, { useState } from 'react';

interface WrapGroupDraft {
  itemPath: string;
  itemLabel: string;
  key: string;
  label: string;
}

interface WrapInGroupDialogProps {
  draft: WrapGroupDraft;
  onCancel: () => void;
  onConfirm: (groupKey: string, groupLabel: string) => void;
}

export function WrapInGroupDialog({ draft, onCancel, onConfirm }: WrapInGroupDialogProps) {
  const [key, setKey] = useState(draft.key);
  const [label, setLabel] = useState(draft.label);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Wrap ${draft.itemLabel} in group`}
        className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">
            Wrap {draft.itemLabel} in group
          </h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p className="text-[13px] leading-6 text-muted">
            Choose the new group key and label before wrapping the selected item.
          </p>
          <div className="space-y-2">
            <label className="block text-[12px] font-medium text-muted" htmlFor="wrap-group-key">
              Group Key
            </label>
            <input
              id="wrap-group-key"
              type="text"
              autoFocus
              value={key}
              onChange={(event) => setKey(event.currentTarget.value)}
              className="w-full rounded-[6px] border border-border/80 bg-surface px-3 py-2 text-[13px] font-mono outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[12px] font-medium text-muted" htmlFor="wrap-group-label">
              Group Label
            </label>
            <input
              id="wrap-group-label"
              type="text"
              value={label}
              onChange={(event) => setLabel(event.currentTarget.value)}
              className="w-full rounded-[6px] border border-border/80 bg-surface px-3 py-2 text-[13px] outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            className="rounded-[6px] border border-border/80 bg-surface px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-ink transition-colors hover:bg-surface-hover focus-ring"
            onClick={onCancel}
          >
            Cancel Wrap
          </button>
          <button
            type="button"
            className="rounded-[6px] border border-accent/30 bg-accent/8 px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-accent transition-colors hover:bg-accent/12 focus-ring"
            onClick={() => {
              if (!key.trim()) return;
              onConfirm(key.trim(), label.trim() || 'Group');
            }}
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}
