import { useDefinition } from '../../state/useDefinition';
import { flatItems } from '../../lib/field-helpers';

export function ResponseSchema() {
  const definition = useDefinition();
  const items = (definition?.items as any[]) || [];
  const rows = flatItems(items);

  return (
    <div className="p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted border-b border-neutral-700">
            <th className="py-1 pr-4">Key</th>
            <th className="py-1 pr-4">Type</th>
            <th className="py-1">Label</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ path, item, depth }) => (
            <tr key={path} className="border-b border-neutral-800">
              <td className="py-1 pr-4" style={{ paddingLeft: depth * 16 }}>
                {item.key}
              </td>
              <td className="py-1 pr-4">
                {item.type === 'group' ? 'object' : (item.dataType || item.type)}
              </td>
              <td className="py-1 text-muted">{item.label || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
