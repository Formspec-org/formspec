interface Item {
  key: string;
  type: string;
  dataType?: string;
  label?: string;
  children?: Item[];
}

interface ComponentRendererProps {
  items: Item[];
}

function inputTypeFor(dataType?: string): string {
  switch (dataType) {
    case 'integer':
    case 'decimal':
      return 'number';
    case 'boolean':
      return 'checkbox';
    default:
      return 'text';
  }
}

function RenderItem({ item }: { item: Item }) {
  switch (item.type) {
    case 'field':
      return (
        <div className="mb-3">
          <label className="block text-sm font-medium text-ink mb-1">
            {item.label || item.key}
          </label>
          <input
            type={inputTypeFor(item.dataType)}
            placeholder={item.label || item.key}
            className="w-full px-2 py-1 text-sm border border-border rounded bg-surface"
          />
        </div>
      );

    case 'group':
      return (
        <fieldset className="mb-4 border border-border rounded p-3">
          <legend className="text-sm font-medium text-ink px-1">
            {item.label || item.key}
          </legend>
          {item.children && <ComponentRenderer items={item.children} />}
        </fieldset>
      );

    case 'display':
      return (
        <div className="mb-3 p-2 bg-subtle rounded text-sm text-muted">
          {item.label || item.key}
        </div>
      );

    default:
      return (
        <div className="mb-3 text-sm text-muted">
          [{item.type}] {item.label || item.key}
        </div>
      );
  }
}

export function ComponentRenderer({ items }: ComponentRendererProps) {
  return (
    <div>
      {items.map((item) => (
        <RenderItem key={item.key} item={item} />
      ))}
    </div>
  );
}
