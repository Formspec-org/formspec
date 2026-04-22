/** @filedesc Small reusable confirmation dialog for destructive actions. */
import { useEscapeKey } from '../hooks/useEscapeKey';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEscapeKey(onCancel, open);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] leading-6 text-muted">{description}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            className="rounded-[12px] border border-border/80 bg-surface px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-ink transition-colors hover:bg-surface-hover"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-[12px] border border-error/30 bg-error/8 px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-error transition-colors hover:bg-error/12"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
