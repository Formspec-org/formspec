import { type Signal, signal } from '@preact/signals';
import type { FormspecItem } from 'formspec-engine';
import { dropTarget, draggedKey, executeDrop } from './drag-drop';
import { InsertionGap } from './inline-add';
import { findItemByKey, updateDefinition } from '../../state/definition';
import { inlineAddState, selectedPath } from '../../state/selection';

const NODE_TYPE_COLORS: Record<string, string> = {
  field: '#D4A34A',
  group: '#5A8FBB',
  display: '#706C68',
};

const DATA_TYPE_COLORS: Record<string, string> = {
  string: 'var(--text-1)',
  text: 'var(--text-1)',
  integer: '#5AAFBB',
  decimal: '#5AAFBB',
  number: '#5AAFBB',
  boolean: '#5FAF5F',
  date: '#C47AB0',
  dateTime: '#C47AB0',
  time: '#C47AB0',
  choice: '#D48A4A',
  multiChoice: '#D48A4A',
  money: '#5FAF5F',
  uri: '#5ABBB0',
  attachment: '#706C68',
};

const expandedByKey = new Map<string, Signal<boolean>>();

function expansionSignal(key: string): Signal<boolean> {
  const existing = expandedByKey.get(key);
  if (existing) {
    return existing;
  }
  const created = signal(true);
  expandedByKey.set(key, created);
  return created;
}

interface TreeNodeProps {
  item: FormspecItem;
  depth: number;
  parentKey: string | null;
  index: number;
}

export function TreeNode({ item, depth, parentKey, index }: TreeNodeProps) {
  const selected = selectedPath.value === item.key;
  const isGroup = item.type === 'group';
  const expanded = expansionSignal(item.key);
  const isDragging = draggedKey.value === item.key;
  const currentDrop = dropTarget.value;

  const dropClass =
    currentDrop &&
    ((currentDrop.mode === 'above' && currentDrop.parentKey === parentKey && currentDrop.insertIndex === index) ||
      (currentDrop.mode === 'below' && currentDrop.parentKey === parentKey && currentDrop.insertIndex === index + 1) ||
      (currentDrop.mode === 'inside' && currentDrop.parentKey === item.key))
      ? currentDrop.mode === 'above'
        ? 'drop-above'
        : currentDrop.mode === 'below'
          ? 'drop-below'
          : 'drop-inside'
      : '';

  function handleDragOver(event: DragEvent) {
    if (!draggedKey.value || draggedKey.value === item.key) {
      return;
    }

    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const upper = rect.height * 0.3;
    const lower = rect.height * 0.7;

    if (isGroup && offsetY > upper && offsetY < lower) {
      const insertIndex = item.children?.length ?? 0;
      dropTarget.value = { parentKey: item.key, insertIndex, mode: 'inside' };
      return;
    }

    if (offsetY <= rect.height / 2) {
      dropTarget.value = { parentKey, insertIndex: index, mode: 'above' };
      return;
    }

    dropTarget.value = { parentKey, insertIndex: index + 1, mode: 'below' };
  }

  return (
    <div
      class={`tree-node-wrapper ${dropClass}`}
      data-depth={depth}
      onDragOver={handleDragOver}
      onDrop={(event) => {
        event.preventDefault();
        executeDrop();
      }}
    >
      {depth > 0 && <div class="tree-depth-line" style={{ left: `${depth * 24 - 12}px` }} />}

      <div
        class={`tree-node ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => {
          selectedPath.value = item.key;
        }}
        role="treeitem"
        aria-selected={selected}
        aria-expanded={isGroup ? expanded.value : undefined}
        aria-level={depth + 2}
        tabIndex={0}
      >
        <span
          class="tree-node-grip"
          aria-hidden="true"
          draggable
          onDragStart={(event) => {
            event.dataTransfer?.setData('text/plain', item.key);
            event.dataTransfer!.effectAllowed = 'move';
            draggedKey.value = item.key;
          }}
          onDragEnd={() => {
            draggedKey.value = null;
            dropTarget.value = null;
          }}
        >
          ⠿
        </span>

        {isGroup && (
          <button
            class="tree-node-toggle"
            onClick={(event) => {
              event.stopPropagation();
              expanded.value = !expanded.value;
            }}
            aria-label={expanded.value ? 'Collapse' : 'Expand'}
          >
            <span
              style={{
                transform: expanded.value ? 'rotate(90deg)' : 'none',
                display: 'inline-block',
                transition: 'transform var(--duration-normal) var(--ease-out)',
              }}
            >
              ▸
            </span>
          </button>
        )}

        <span
          class="tree-node-dot"
          style={{ background: NODE_TYPE_COLORS[item.type] ?? 'var(--text-2)' }}
          aria-hidden="true"
        />

        <span class="tree-node-label">{item.label || item.key}</span>
        <span class="tree-node-key">{item.key}</span>

        {item.dataType && (
          <span
            class="tree-node-badge"
            style={{ color: DATA_TYPE_COLORS[item.dataType] ?? 'var(--text-1)' }}
          >
            {item.dataType}
          </span>
        )}

        {item.required && (
          <span class="tree-node-bind" title="Required">
            *
          </span>
        )}
        {item.calculate && (
          <span class="tree-node-bind" title="Calculated">
            ƒ
          </span>
        )}
        {item.constraint && (
          <span class="tree-node-bind" title="Constraint">
            ✓
          </span>
        )}
        {item.relevant && (
          <span class="tree-node-bind" title="Conditional">
            ⚡
          </span>
        )}

        <span class="tree-node-actions">
          <button
            class="tree-action"
            title="Move up"
            onClick={(event) => {
              event.stopPropagation();
              moveItem(item.key, -1);
            }}
          >
            ↑
          </button>
          <button
            class="tree-action"
            title="Move down"
            onClick={(event) => {
              event.stopPropagation();
              moveItem(item.key, 1);
            }}
          >
            ↓
          </button>
          <button
            class="tree-action tree-action-danger"
            title="Delete"
            onClick={(event) => {
              event.stopPropagation();
              deleteItem(item.key);
            }}
          >
            ×
          </button>
        </span>
      </div>

      {isGroup && expanded.value && (
        <div role="group">
          <InsertionGap parentKey={item.key} insertIndex={0} />
          {item.children?.map((child, childIndex) => (
            <div key={child.key}>
              <TreeNode item={child} depth={depth + 1} parentKey={item.key} index={childIndex} />
              <InsertionGap parentKey={item.key} insertIndex={childIndex + 1} />
            </div>
          ))}
          <div class="tree-group-add-row" style={{ paddingLeft: `${(depth + 1) * 24 + 12}px` }}>
            <button
              class="tree-add-btn tree-add-btn-inline"
              onClick={() => {
                inlineAddState.value = {
                  parentKey: item.key,
                  insertIndex: item.children?.length ?? 0,
                };
              }}
            >
              + Add Item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function moveItem(key: string, direction: -1 | 1) {
  updateDefinition((def) => {
    const found = findItemByKey(key, def.items);
    if (!found) {
      return;
    }
    const nextIndex = found.index + direction;
    if (nextIndex < 0 || nextIndex >= found.siblings.length) {
      return;
    }
    [found.siblings[found.index], found.siblings[nextIndex]] = [
      found.siblings[nextIndex],
      found.siblings[found.index],
    ];
  });
}

function deleteItem(key: string) {
  updateDefinition((def) => {
    const found = findItemByKey(key, def.items);
    if (!found) {
      return;
    }
    found.siblings.splice(found.index, 1);
  });

  if (selectedPath.value === key) {
    selectedPath.value = null;
  }
}
