import { definition, definitionVersion } from '../../state/definition';
import { inlineAddState, selectedPath } from '../../state/selection';
import { InsertionGap } from './inline-add';
import { TreeNode } from './tree-node';

export function TreeEditor() {
  definitionVersion.value;
  const current = definition.value;
  const rootSelected = selectedPath.value === '';

  return (
    <div class="tree-editor" role="tree" aria-label="Definition tree">
      <div
        class={`tree-header ${rootSelected ? 'selected' : ''}`}
        onClick={() => {
          selectedPath.value = '';
        }}
        role="treeitem"
        aria-level={1}
        aria-selected={rootSelected}
        tabIndex={0}
      >
        <span class="tree-header-dot" />
        <span class="tree-header-title">{current.title || 'Untitled Form'}</span>
        <span class="tree-header-meta">
          {current.url} · v{current.version}
        </span>
      </div>

      <InsertionGap parentKey={null} insertIndex={0} />
      {current.items.map((item, index) => (
        <div key={item.key}>
          <TreeNode item={item} depth={0} parentKey={null} index={index} />
          <InsertionGap parentKey={null} insertIndex={index + 1} />
        </div>
      ))}

      <div class="tree-add-root">
        <button
          class="tree-add-btn"
          aria-label="Add item to root"
          onClick={() => {
            inlineAddState.value = { parentKey: null, insertIndex: current.items.length };
          }}
        >
          + Add Item
        </button>
      </div>
    </div>
  );
}
