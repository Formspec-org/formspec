import { effect, signal } from '@preact/signals';
import type { FormspecItem } from 'formspec-engine';
import type { NewItemType } from '../../types';
import { definition, findItemByKey, updateDefinition } from '../../state/definition';
import { inlineAddState, selectedPath } from '../../state/selection';

const inlineLabel = signal('');
const inlineItemType = signal<NewItemType>('field');
let lastInlineKey = '';

effect(() => {
  const state = inlineAddState.value;
  const key = state ? `${state.parentKey ?? 'root'}:${state.insertIndex}` : '';
  if (key !== lastInlineKey) {
    inlineLabel.value = '';
    inlineItemType.value = 'field';
    lastInlineKey = key;
  }
});

function collectKeys(items: FormspecItem[], set = new Set<string>()): Set<string> {
  for (const item of items) {
    set.add(item.key);
    if (item.children?.length) {
      collectKeys(item.children, set);
    }
  }
  return set;
}

function makeItemKey(label: string): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || 'item';

  const existing = collectKeys(definition.value.items);
  if (!existing.has(base)) {
    return base;
  }

  let index = 2;
  while (existing.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

export function InlineAddForm() {
  const state = inlineAddState.value;

  if (!state) {
    return null;
  }
  const activeState = state;

  function handleCreate() {
    const labelValue = inlineLabel.value.trim();
    if (!labelValue) {
      return;
    }

    const key = makeItemKey(labelValue);
    const newItem: FormspecItem = {
      key,
      type: inlineItemType.value,
      label: labelValue,
      ...(inlineItemType.value === 'field' ? { dataType: 'string' as const } : {}),
      ...(inlineItemType.value === 'group' ? { children: [] as FormspecItem[] } : {}),
    };

    updateDefinition((def) => {
      if (activeState.parentKey === null) {
        def.items.splice(activeState.insertIndex, 0, newItem);
        return;
      }
      const parent = findItemByKey(activeState.parentKey, def.items);
      if (!parent || parent.item.type !== 'group') {
        return;
      }
      if (!parent.item.children) {
        parent.item.children = [];
      }
      parent.item.children.splice(activeState.insertIndex, 0, newItem);
    });

    selectedPath.value = key;
    inlineAddState.value = null;
  }

  function handleCancel() {
    inlineAddState.value = null;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCreate();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  }

  return (
    <div class="inline-add-form">
      <input
        class="studio-input inline-add-input"
        placeholder="Item label..."
        value={inlineLabel.value}
        onInput={(event) => {
          inlineLabel.value = (event.target as HTMLInputElement).value;
        }}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <select
        class="studio-select inline-add-type"
        value={inlineItemType.value}
        onChange={(event) => {
          inlineItemType.value = (event.target as HTMLSelectElement).value as NewItemType;
        }}
      >
        <option value="field">field</option>
        <option value="group">group</option>
        <option value="display">display</option>
      </select>
      <button class="btn-primary inline-add-confirm" onClick={handleCreate} title="Create (Enter)">
        ↵
      </button>
      <button class="btn-ghost inline-add-cancel" onClick={handleCancel} title="Cancel (Escape)">
        ×
      </button>
    </div>
  );
}

export function InsertionGap({
  parentKey,
  insertIndex,
}: {
  parentKey: string | null;
  insertIndex: number;
}) {
  const active =
    inlineAddState.value?.parentKey === parentKey &&
    inlineAddState.value?.insertIndex === insertIndex;

  if (active) {
    return <InlineAddForm />;
  }

  return (
    <div
      class="tree-insertion-gap"
      onClick={() => {
        inlineAddState.value = { parentKey, insertIndex };
      }}
    >
      <span class="tree-insertion-gap-icon">+</span>
    </div>
  );
}
