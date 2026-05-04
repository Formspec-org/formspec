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
      role="tablist"
      aria-label="Layout mode"
      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1 shadow-sm"
    >
      {modes.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="tab"
          aria-selected={mode === entry.id}
          onClick={() => onSetMode(entry.id)}
          className={`rounded-sm px-3 py-1 text-[11px] font-bold tracking-normal transition-colors ${
            mode === entry.id
              ? 'bg-accent text-surface shadow-sm'
              : 'text-muted hover:bg-subtle hover:text-ink'
          }`}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
