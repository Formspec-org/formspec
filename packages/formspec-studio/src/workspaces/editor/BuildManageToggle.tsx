/** @filedesc Accessible Build/Manage/Screener segmented control for the Editor workspace. */
import { useMemo } from 'react';

export type EditorView = 'build' | 'manage' | 'screener';

interface BuildManageToggleProps {
  activeView: EditorView;
  onViewChange: (view: EditorView) => void;
  manageCount?: number;
  showScreener?: boolean;
}

const BASE_OPTIONS: { id: EditorView; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'manage', label: 'Manage' },
];

const SCREENER_OPTION: { id: EditorView; label: string } = { id: 'screener', label: 'Screener' };

export function BuildManageToggle({ activeView, onViewChange, manageCount, showScreener }: BuildManageToggleProps) {
  const options = useMemo(
    () => (showScreener ? [...BASE_OPTIONS, SCREENER_OPTION] : BASE_OPTIONS),
    [showScreener],
  );

  const handleKeyDown = (e: React.KeyboardEvent, current: EditorView) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const currentIndex = options.findIndex((o) => o.id === current);
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const nextIndex = forward
      ? (currentIndex + 1) % options.length
      : (currentIndex - 1 + options.length) % options.length;
    onViewChange(options[nextIndex].id);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Editor view"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-subtle p-0.5 shadow-inner"
    >
      {options.map(({ id, label }) => {
        const isActive = activeView === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            tabIndex={isActive ? 0 : -1}
            onClick={() => {
              if (!isActive) onViewChange(id);
            }}
            onKeyDown={(e) => handleKeyDown(e, id)}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-normal rounded-sm transition-all duration-200 cursor-pointer focus-ring ${
              isActive
                ? id === 'screener'
                  ? 'bg-amber-600 text-surface shadow-sm'
                  : 'bg-accent text-surface shadow-sm'
                : 'text-muted hover:bg-surface hover:text-ink'
            }`}
          >
            {label}
            {id === 'manage' && manageCount ? (
              <span className={`ml-1.5 text-[9px] font-extrabold ${isActive ? 'text-surface/70' : 'text-accent/60'}`}>
                {manageCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
