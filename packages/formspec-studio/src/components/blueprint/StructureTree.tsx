import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import { FieldIcon } from '../ui/FieldIcon';
import { Section } from '../ui/Section';

interface ItemNode {
  key: string;
  type: string;
  dataType?: string;
  label?: string;
  children?: ItemNode[];
  [k: string]: unknown;
}

function TreeNode({ item, depth }: { item: ItemNode; depth: number }) {
  const { selectedKey, select } = useSelection();
  const isSelected = selectedKey === item.key;

  return (
    <>
      <button
        type="button"
        data-testid={`tree-node-${item.key}`}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-sm text-left rounded-sm transition-colors ${
          isSelected
            ? 'bg-accent/10 text-accent'
            : 'text-ink hover:bg-subtle'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => select(item.key, item.type)}
      >
        {item.type === 'field' && item.dataType ? (
          <FieldIcon dataType={item.dataType} />
        ) : item.type === 'group' ? (
          <span className="font-mono text-xs text-muted">{'\u25B8'}</span>
        ) : (
          <span className="font-mono text-xs text-muted">{'\u00B6'}</span>
        )}
        <span className="truncate">{item.key}</span>
        {item.label && item.type === 'group' && (
          <span className="text-xs text-muted ml-auto truncate">{item.label}</span>
        )}
      </button>
      {item.children?.map((child) => (
        <TreeNode key={child.key} item={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function StructureTree() {
  const definition = useDefinition();
  const items = (definition.items ?? []) as ItemNode[];

  return (
    <Section title="Structure">
      {items.length === 0 ? (
        <p className="text-sm text-muted py-2">No items defined</p>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => (
            <TreeNode key={item.key} item={item} depth={0} />
          ))}
        </div>
      )}
    </Section>
  );
}
