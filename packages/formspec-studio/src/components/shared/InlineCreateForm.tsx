/** @filedesc Reusable inline create form with accent border, input area, and Cancel/Create actions. */
interface InlineCreateFormProps {
  children: React.ReactNode;
  example?: React.ReactNode;
  onCancel: () => void;
  onCreate: () => void;
  createLabel?: string;
  canCreate?: boolean;
  accentColor?: 'accent' | 'logic' | 'teal';
}

export function InlineCreateForm({
  children,
  example,
  onCancel,
  onCreate,
  createLabel = 'Create',
  canCreate = true,
  accentColor = 'accent',
}: InlineCreateFormProps) {
  const borderClass = {
    accent: 'border-accent/30 bg-accent/5',
    logic: 'border-logic/30 bg-logic/5',
    teal: 'border-teal/30 bg-teal/5',
  }[accentColor];

  const btnClass = {
    accent: 'text-accent hover:text-accent-hover',
    logic: 'text-logic hover:text-logic-hover',
    teal: 'text-teal hover:text-teal-hover',
  }[accentColor];

  return (
    <div className={`border rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 ${borderClass}`}>
      {children}
      {example && (
        <div className="text-[11px] text-muted italic">
          {example}
        </div>
      )}
      <div className="flex justify-end items-center gap-2 pt-1">
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
          className={`text-[10px] uppercase font-bold transition-colors disabled:opacity-50 ${btnClass}`}
        >
          {createLabel}
        </button>
      </div>
    </div>
  );
}
