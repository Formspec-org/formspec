/** @filedesc Horizontal bar of breakpoint toggle buttons for Focus Mode. */

interface BreakpointBarProps {
  breakpointNames: string[];
  breakpointValues?: Record<string, number>;
  active: string;
  onSelect: (bp: string) => void;
}

export function BreakpointBar({
  breakpointNames,
  breakpointValues,
  active,
  onSelect,
}: BreakpointBarProps) {
  const allBreakpoints = ['base', ...breakpointNames];

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-border/40 bg-subtle/30">
      {allBreakpoints.map((bp) => {
        const isActive = active === bp;
        const tooltip =
          bp === 'base'
            ? 'Base'
            : breakpointValues?.[bp] !== undefined
              ? `${bp} (${breakpointValues[bp]}px)`
              : bp;

        return (
          <button
            key={bp}
            type="button"
            title={tooltip}
            aria-pressed={isActive}
            onClick={() => onSelect(bp)}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded transition-all ${
              isActive
                ? 'bg-ink text-white shadow-sm'
                : 'text-muted hover:text-ink hover:bg-subtle'
            }`}
          >
            {bp === 'base' ? 'Base' : bp}
          </button>
        );
      })}
    </div>
  );
}
