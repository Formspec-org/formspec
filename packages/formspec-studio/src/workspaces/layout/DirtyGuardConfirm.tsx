/** @filedesc Reusable confirm dialog for discarding unsaved popover changes. */
import { useState } from 'react';

export interface DirtyGuardConfirmProps {
  onDiscard: () => void;
  onCancel: () => void;
}

export function DirtyGuardConfirm({ onDiscard, onCancel }: DirtyGuardConfirmProps) {
  return (
    <div
      data-testid="dirty-guard-confirm"
      className="absolute inset-x-0 bottom-0 rounded-b border-t border-border bg-surface p-3 shadow-lg"
    >
      <p className="text-[12px] font-ui text-ink mb-2">Discard unsaved changes?</p>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="dirty-guard-discard"
          onClick={onDiscard}
          className="rounded-full border border-error bg-surface px-3 py-1 text-[12px] font-semibold text-error hover:bg-error/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/70"
        >
          Discard
        </button>
        <button
          type="button"
          data-testid="dirty-guard-cancel"
          onClick={onCancel}
          className="rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-semibold text-ink hover:border-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          Keep editing
        </button>
      </div>
    </div>
  );
}

/** Hook to manage dirty state for popover inputs. */
export function useDirtyGuard() {
  const [dirtyFields, setDirtyFields] = useState<Record<string, boolean>>({});
  const isDirty = Object.values(dirtyFields).some(Boolean);

  const markDirty = (fieldId: string, isDirty: boolean) => {
    setDirtyFields((prev) => ({ ...prev, [fieldId]: isDirty }));
  };

  const reset = () => {
    setDirtyFields({});
  };

  return { isDirty, markDirty, reset, dirtyFields };
}
