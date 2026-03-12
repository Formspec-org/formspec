import { useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface Item {
  key: string;
  type: string;
  dataType?: string;
  label?: string;
  children?: Item[];
  repeatable?: boolean;
  options?: Option[];
}

interface ComponentRendererProps {
  items: Item[];
}

function FieldInput({ item }: { item: Item }) {
  const label = item.label || item.key;
  const id = `field-${item.key}`;

  if (item.dataType === 'choice') {
    return (
      <div className="mb-3">
        <label htmlFor={id} className="block text-sm font-medium text-ink mb-1">
          {label}
        </label>
        <select
          id={id}
          className="w-full px-2 py-1 text-sm border border-border rounded bg-surface"
        >
          <option value="">Select…</option>
          {(item.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (item.dataType === 'date') {
    return (
      <div className="mb-3">
        <label htmlFor={id} className="block text-sm font-medium text-ink mb-1">
          {label}
        </label>
        <input
          id={id}
          type="date"
          className="w-full px-2 py-1 text-sm border border-border rounded bg-surface"
        />
      </div>
    );
  }

  const type = (item.dataType === 'integer' || item.dataType === 'decimal') ? 'number'
    : item.dataType === 'boolean' ? 'checkbox'
    : 'text';

  return (
    <div className="mb-3">
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={label}
        className="w-full px-2 py-1 text-sm border border-border rounded bg-surface"
      />
    </div>
  );
}

function RepeatableGroup({ item }: { item: Item }) {
  const [instances, setInstances] = useState<number[]>([]);
  const label = item.label || item.key;

  return (
    <fieldset className="mb-4 border border-border rounded p-3">
      <legend className="text-sm font-medium text-ink px-1">{label}</legend>
      {instances.map((id, idx) => (
        <div key={id} className="mb-3 border border-border rounded p-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted">{label} #{idx + 1}</span>
            <button
              type="button"
              className="text-xs text-red-600 hover:underline"
              onClick={() => setInstances((prev) => prev.filter((i) => i !== id))}
            >
              Remove
            </button>
          </div>
          {item.children && <ComponentRenderer items={item.children} />}
        </div>
      ))}
      <button
        type="button"
        className="text-sm text-accent hover:underline"
        onClick={() => setInstances((prev) => [...prev, Date.now()])}
      >
        Add {label}
      </button>
    </fieldset>
  );
}

function RenderItem({ item }: { item: Item }) {
  switch (item.type) {
    case 'field':
      return <FieldInput item={item} />;

    case 'group':
      if (item.repeatable) {
        return <RepeatableGroup item={item} />;
      }
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
