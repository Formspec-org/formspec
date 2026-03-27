/** @filedesc Toggle for form flow mode: single, wizard, or tabs. */

type FlowMode = 'single' | 'wizard' | 'tabs';

interface ModeSelectorProps {
  mode: FlowMode;
  onSetMode: (mode: FlowMode) => void;
}

const modes: Array<{ id: FlowMode; label: string }> = [
  { id: 'single', label: 'Single' },
  { id: 'wizard', label: 'Wizard' },
  { id: 'tabs', label: 'Tabs' },
];

export function ModeSelector({ mode, onSetMode }: ModeSelectorProps) {
  return (
    <div
      data-testid="mode-selector"
      className="inline-flex items-center gap-1 rounded-[14px] border border-border bg-surface p-1 shadow-sm"
    >
      {modes.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onSetMode(entry.id)}
          className={`rounded-[10px] px-3.5 py-1.5 text-[12px] font-semibold tracking-wide transition-colors ${
            mode === entry.id
              ? 'bg-accent text-white'
              : 'text-muted hover:bg-subtle hover:text-ink'
          }`}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
