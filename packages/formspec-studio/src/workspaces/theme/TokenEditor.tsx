import { useTheme } from '../../state/useTheme';

export function TokenEditor() {
  const theme = useTheme();
  const tokens = theme?.tokens;

  if (!tokens || Object.keys(tokens).length === 0) {
    return (
      <div className="p-4 text-sm text-muted">
        <p>No tokens defined</p>
        <button type="button" className="mt-2 text-accent hover:underline text-sm">+ Add Token</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {Object.entries(tokens).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between px-2 py-1 text-sm rounded hover:bg-subtle">
          <span className="font-medium text-ink">{key}</span>
          <span className="text-muted">{String(value)}</span>
        </div>
      ))}
      <button type="button" className="mt-2 text-accent hover:underline text-sm self-start px-2">+ Add Token</button>
    </div>
  );
}
