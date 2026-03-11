import { useState } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import { useDispatch } from '../../state/useDispatch';
import { bindsFor } from '../../lib/field-helpers';
import { FieldBlock } from './FieldBlock';
import { GroupBlock } from './GroupBlock';
import { DisplayBlock } from './DisplayBlock';
import { AddItemPicker } from './AddItemPicker';

interface Item {
  key: string;
  type: string;
  dataType?: string;
  label?: string;
  children?: Item[];
}

function renderItems(
  items: Item[],
  allBinds: Record<string, Record<string, string>> | undefined,
  selectedKey: string | null,
  select: (key: string, type: string) => void,
  depth: number,
  prefix: string,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  for (const item of items) {
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    const isSelected = selectedKey === path;

    if (item.type === 'group') {
      nodes.push(
        <GroupBlock
          key={path}
          itemKey={item.key}
          label={item.label}
          depth={depth}
          selected={isSelected}
          onSelect={() => select(path, 'group')}
        >
          {item.children
            ? renderItems(item.children, allBinds, selectedKey, select, depth + 1, path)
            : null}
        </GroupBlock>
      );
    } else if (item.type === 'display') {
      nodes.push(
        <DisplayBlock
          key={path}
          itemKey={item.key}
          label={item.label}
          depth={depth}
          selected={isSelected}
          onSelect={() => select(path, 'display')}
        />
      );
    } else {
      nodes.push(
        <FieldBlock
          key={path}
          itemKey={item.key}
          label={item.label}
          dataType={item.dataType}
          binds={bindsFor(allBinds, path)}
          depth={depth}
          selected={isSelected}
          onSelect={() => select(path, item.type)}
        />
      );
    }
  }
  return nodes;
}

export function EditorCanvas() {
  const definition = useDefinition();
  const { selectedKey, select } = useSelection();
  const dispatch = useDispatch();
  const [showPicker, setShowPicker] = useState(false);

  const items: Item[] = (definition?.items as Item[]) || [];
  const allBinds = definition?.binds as Record<string, Record<string, string>> | undefined;

  const handleAddItem = (type: string, dataType?: string) => {
    const key = `${type}${Date.now() % 10000}`;
    dispatch({
      type: 'definition.addItem',
      payload: { key, type, dataType, label: key },
    });
    setShowPicker(false);
  };

  return (
    <div className="flex flex-col gap-1 p-4">
      <div className="flex justify-end mb-2">
        <button
          data-testid="add-item"
          className="px-3 py-1.5 text-sm rounded bg-accent text-on-accent hover:opacity-90"
          onClick={() => setShowPicker(!showPicker)}
        >
          + Add
        </button>
      </div>
      {showPicker && (
        <AddItemPicker
          onAdd={handleAddItem}
          onClose={() => setShowPicker(false)}
        />
      )}
      {renderItems(items, allBinds, selectedKey, select, 0, '')}
    </div>
  );
}
