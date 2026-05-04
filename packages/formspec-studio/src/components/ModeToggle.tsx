/** @filedesc Segmented mode switcher for the four primary Studio modes. */
import { useRef, useEffect, useState, useCallback } from 'react';
import { type StudioMode, MODE_ORDER } from '../studio-app/ModeProvider';

const MODES: { id: StudioMode; label: string; help: string }[] = [
  { id: 'chat', label: 'Chat', help: 'Describe what you need — AI builds and refines' },
  { id: 'edit', label: 'Edit', help: 'Structure editing — fields, groups, logic, validation' },
  { id: 'design', label: 'Design', help: 'Styling — colors, typography, spacing, pages, layout' },
  { id: 'preview', label: 'Preview', help: 'Respondent simulation — test the form as a user' },
];

interface ModeToggleProps {
  mode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
  compact?: boolean;
}

export function ModeToggle({ mode, onModeChange, compact = false }: ModeToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pillStyle, setPillStyle] = useState<React.CSSProperties>({});

  // Update pill position when mode changes
  useEffect(() => {
    const idx = MODES.findIndex((m) => m.id === mode);
    const btn = buttonRefs.current[idx];
    const container = containerRef.current;
    if (!btn || !container) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();

    setPillStyle({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
      transition: 'left var(--transition-fast), width var(--transition-fast)',
    });
  }, [mode]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const lastIndex = MODES.length - 1;
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = lastIndex;

    onModeChange(MODES[nextIndex].id);
    buttonRefs.current[nextIndex]?.focus();
  }, [onModeChange]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center rounded-md border border-border bg-subtle p-0.5 shadow-inner"
      role="tablist"
      aria-label="Studio modes"
    >
      {/* Animated segment indicator */}
      <div
        className="absolute top-0.5 bottom-0.5 rounded-sm bg-surface shadow-sm border border-border/50 pointer-events-none"
        style={pillStyle}
        aria-hidden="true"
      />


      {MODES.map(({ id, label, help }, index) => {
        const isActive = mode === id;
        return (
          <button
            key={id}
            ref={(node) => { buttonRefs.current[index] = node; }}
            role="tab"
            aria-selected={isActive}
            aria-controls={`studio-surface-${id}`}
            tabIndex={isActive ? 0 : -1}
            data-testid={`mode-toggle-${id}`}
            title={help}
            className={`relative z-10 px-3 py-1 text-[13px] font-medium rounded-sm transition-all cursor-pointer whitespace-nowrap focus-ring ${
              isActive
                ? 'text-ink font-semibold'
                : 'text-muted hover:text-ink'
            } ${compact ? 'px-2 py-0.5 text-[12px]' : ''}`}
            onClick={() => onModeChange(id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
