/** @filedesc Accessible Build/Manage segmented control for the Editor workspace (role="radiogroup"). */

export type EditorView = 'build' | 'manage';

interface BuildManageToggleProps {
  activeView: EditorView;
  onViewChange: (view: EditorView) => void;
  manageCount?: number;
}

const OPTIONS: { id: EditorView; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'manage', label: 'Manage' },
];

export function BuildManageToggle({ activeView, onViewChange, manageCount }: BuildManageToggleProps) {
  const handleKeyDown = (e: React.KeyboardEvent, current: EditorView) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const next: EditorView = current === 'build' ? 'manage' : 'build';
    onViewChange(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Editor view"
      className="inline-flex items-center gap-1 rounded-[14px] border border-border bg-subtle/50 p-1"
    >
      {OPTIONS.map(({ id, label }) => {
        const isActive = activeView === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            tabIndex={isActive ? 0 : -1}
            onClick={() => { if (!isActive) onViewChange(id); }}
            onKeyDown={(e) => handleKeyDown(e, id)}
            className={`px-3.5 py-1.5 text-[13px] font-semibold rounded-[10px] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
              isActive
                ? 'bg-accent text-white shadow-sm'
                : 'text-muted hover:bg-subtle hover:text-ink'
            }`}
          >
            {label}
            {id === 'manage' && manageCount ? (
              <span className="ml-1.5 text-[11px] font-normal opacity-70">{manageCount}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
