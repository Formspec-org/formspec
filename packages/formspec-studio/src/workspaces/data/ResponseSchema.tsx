import { useState } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { flatItems } from '../../lib/field-helpers';
import { useOptionalSelection } from '../../state/useSelection';

export function ResponseSchema() {
  const definition = useDefinition();
  const selection = useOptionalSelection();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const items = (definition?.items as any[]) || [];
  const rows = flatItems(items);

  const selectPath = (path: string, type: string) => {
    setSelectedPath(path);
    selection?.select(path, type);
  };

  return (
    <div className="p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted border-b border-border">
            <th className="py-1 pr-4">Key</th>
            <th className="py-1 pr-4">Type</th>
            <th className="py-1">Label</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ path, item, depth }) => (
            <tr
              key={path}
              className={`border-b border-border ${(selection?.selectedKey ?? selectedPath) === path ? 'bg-subtle' : ''}`}
              data-selected={(selection?.selectedKey ?? selectedPath) === path ? 'true' : 'false'}
              onClick={() => selectPath(path, item.type)}
            >
              <td className="py-1 pr-4" style={{ paddingLeft: depth * 16 }}>
                {item.key}
              </td>
              <td className="py-1 pr-4">
                {item.type === 'group'
                  ? item.repeatable
                    ? 'array'
                    : 'object'
                  : (item.dataType || item.type)}
              </td>
              <td className="py-1">
                {(item.label as string) ? (
                  <button
                    type="button"
                    className="text-left text-accent hover:underline"
                    onClick={() => selectPath(path, item.type)}
                  >
                    {item.label as string}
                  </button>
                ) : (
                  <span className="text-muted" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
