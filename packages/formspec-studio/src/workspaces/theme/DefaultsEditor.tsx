import { useTheme } from '../../state/useTheme';

export function DefaultsEditor() {
  const theme = useTheme();
  const defaults = theme?.defaults;

  if (!defaults || Object.keys(defaults).length === 0) {
    return (
      <div className="p-4 text-sm text-muted">
        <p>No defaults defined</p>
        <button type="button" className="mt-2 text-accent hover:underline text-sm">+ Add Default</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {Object.entries(defaults).map(([property, value]) => (
        <div key={property} className="flex items-center justify-between px-2 py-1 text-sm rounded hover:bg-subtle">
          <span className="font-medium text-ink">{property}</span>
          <span className="text-muted">{String(value)}</span>
        </div>
      ))}
      <button type="button" className="mt-2 text-accent hover:underline text-sm self-start px-2">+ Add Default</button>
    </div>
  );
}
