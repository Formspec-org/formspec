import { useCallback, useRef, useEffect } from 'react';
import { useSelection } from '../../state/useSelection';
import { useDefinition } from '../../state/useDefinition';
import { useDispatch } from '../../state/useDispatch';
import { flatItems, bindsFor, arrayBindsFor, dataTypeInfo } from '../../lib/field-helpers';

/**
 * Displays and edits properties for the currently selected item.
 * Shows an empty state when nothing is selected.
 */
export function ItemProperties() {
  const { selectedKey, selectedType } = useSelection();
  const definition = useDefinition();
  const dispatch = useDispatch();
  const keyInputRef = useRef<HTMLInputElement>(null);

  const handleRename = useCallback(
    (originalPath: string, inputEl: HTMLInputElement) => {
      const newKey = inputEl.value;
      if (newKey && newKey !== originalPath.split('.').pop()) {
        dispatch({
          type: 'definition.renameItem',
          payload: { path: originalPath, newKey },
        });
      }
    },
    [dispatch],
  );

  const handleDelete = useCallback(
    (path: string) => {
      dispatch({
        type: 'definition.deleteItem',
        payload: { path },
      });
    },
    [dispatch],
  );

  const handleDuplicate = useCallback(
    (path: string) => {
      dispatch({
        type: 'definition.duplicateItem',
        payload: { path },
      });
    },
    [dispatch],
  );

  // Find the item by walking the flat item tree
  const items = definition.items || [];
  const flat = flatItems(items as any);
  const found = selectedKey ? flat.find((f) => f.path === selectedKey) : null;
  const itemPath = found?.path ?? '';

  useEffect(() => {
    const el = keyInputRef.current;
    if (!el || !itemPath) return;
    const onBlur = () => {
      handleRename(itemPath, el);
    };
    el.addEventListener('blur', onBlur);
    return () => el.removeEventListener('blur', onBlur);
  }, [itemPath, handleRename]);

  if (!selectedKey) {
    return (
      <div className="p-4 text-sm text-muted">
        Select an item to inspect
      </div>
    );
  }

  if (!found) {
    return (
      <div className="p-4 text-sm text-muted">
        Item not found: {selectedKey}
      </div>
    );
  }

  const { item, path } = found;
  // binds may be array (engine format) or object (legacy display format)
  const rawBinds = definition.binds;
  const binds = Array.isArray(rawBinds)
    ? arrayBindsFor(rawBinds, path)
    : bindsFor(rawBinds as any, path);
  const dtInfo = item.dataType ? dataTypeInfo(item.dataType) : null;
  const currentKey = path.split('.').pop() || path;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-medium">Properties</h2>

      {/* Key (editable) */}
      <div>
        <label className="text-xs text-muted block mb-1">Key</label>
        <input
          ref={keyInputRef}
          type="text"
          className="w-full px-2 py-1 text-sm border border-border rounded bg-surface"
          defaultValue={currentKey}
        />
      </div>

      {/* Type */}
      <div>
        <label className="text-xs text-muted block mb-1">Type</label>
        <div className="text-sm">{selectedType || item.type}</div>
      </div>

      {/* Data type */}
      {dtInfo && (
        <div>
          <label className="text-xs text-muted block mb-1">Data Type</label>
          <div className={`text-sm ${dtInfo.color}`}>
            <span className="mr-1">{dtInfo.icon}</span>
            {dtInfo.label}
          </div>
        </div>
      )}

      {/* Binds */}
      {Object.keys(binds).length > 0 && (
        <div>
          <label className="text-xs text-muted block mb-1">Binds</label>
          <div className="space-y-1">
            {Object.entries(binds).map(([prop, expr]) => (
              <div key={prop} className="text-xs border border-border rounded p-2">
                <span className="font-medium">{prop}:</span>{' '}
                <span className="font-mono text-muted">{expr}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <button
          className="px-3 py-1 text-xs rounded bg-surface border border-border hover:bg-surface-hover"
          onClick={() => handleDuplicate(path)}
        >
          Duplicate
        </button>
        <button
          className="px-3 py-1 text-xs rounded bg-error text-on-error hover:bg-error/80"
          onClick={() => handleDelete(path)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
