import { useTheme } from '../../state/useTheme';

export function ItemOverrides() {
  const theme = useTheme();
  const items = theme?.items as Record<string, Record<string, unknown>> | undefined;

  if (!items || Object.keys(items).length === 0) {
    return (
      <div className="p-4 text-sm text-muted">
        <p>No item overrides defined</p>
        <button type="button" className="mt-2 text-accent hover:underline text-sm">+ Add Item Override</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {Object.entries(items).map(([itemName, overrides]) => (
        <div key={itemName} className="border border-border rounded p-2 text-sm">
          <div className="font-medium text-ink mb-1">{itemName}</div>
          <div className="text-muted">
            {Object.entries(overrides).map(([prop, val]) => (
              <span key={prop} className="mr-2">{prop}: {String(val)}</span>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="mt-2 text-accent hover:underline text-sm self-start px-2">+ Add Item Override</button>
    </div>
  );
}
