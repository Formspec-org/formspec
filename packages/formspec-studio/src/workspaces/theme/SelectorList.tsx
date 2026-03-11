import { useTheme } from '../../state/useTheme';

interface Selector {
  match: Record<string, string>;
  properties: Record<string, unknown>;
}

export function SelectorList() {
  const theme = useTheme();
  const selectors = (theme?.selectors ?? []) as Selector[];

  if (selectors.length === 0) {
    return <div className="p-4 text-sm text-muted">No selectors defined</div>;
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {selectors.map((selector, index) => (
        <div key={index} className="border border-border rounded p-2 text-sm">
          <div className="font-medium text-ink mb-1">
            {Object.entries(selector.match).map(([k, v]) => (
              <span key={k} className="mr-2">{k}: {v}</span>
            ))}
          </div>
          <div className="text-muted">
            {Object.entries(selector.properties).map(([k, v]) => (
              <span key={k} className="mr-2">{k}: {String(v)}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
