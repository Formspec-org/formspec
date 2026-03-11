import { useTheme } from '../../state/useTheme';

export function BreakpointEditor() {
  const theme = useTheme();
  const breakpoints = theme?.breakpoints;

  if (!breakpoints || Object.keys(breakpoints).length === 0) {
    return <div className="p-4 text-sm text-muted">No breakpoints defined</div>;
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {Object.entries(breakpoints).map(([name, value]) => (
        <div key={name} className="flex items-center justify-between px-2 py-1 text-sm rounded hover:bg-subtle">
          <span className="font-medium text-ink">{name}</span>
          <span className="text-muted">{value}px</span>
        </div>
      ))}
    </div>
  );
}
