/** @filedesc Pill-style mode switcher for the four primary Studio modes. */
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
      transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1), width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
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
      className="relative flex items-center rounded-full border border-border/40 bg-subtle/40 p-1 shadow-inner backdrop-blur-sm"
      role="tablist"
      aria-label="Studio modes"
    >
      {/* Animated pill indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-full bg-surface shadow-premium-lg border border-border/10 pointer-events-none"
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
            className={`relative z-10 px-4 py-1.5 text-[13.5px] font-medium rounded-full transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-inset ${
              isActive
                ? 'text-ink font-semibold'
                : 'text-muted/80 hover:text-ink'
            } ${compact ? 'px-3 py-1 text-[12px]' : ''}`}
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
