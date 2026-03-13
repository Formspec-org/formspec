import { useCallback, useEffect, useMemo, useRef } from 'react';
import { bindsFor, shapesFor } from '../../../lib/field-helpers';
import { buildDefLookup, isLayoutId } from '../../../lib/tree-helpers';
import { useDefinition } from '../../../state/useDefinition';
import { useDispatch } from '../../../state/useDispatch';
import { useProject } from '../../../state/useProject';
import { useSelection } from '../../../state/useSelection';
import { DefinitionProperties } from './DefinitionProperties';
import { LayoutProperties } from './LayoutProperties';
import { MultiSelectSummary } from './MultiSelectSummary';
import { SelectedItemProperties } from './SelectedItemProperties';

export function ItemProperties({ showActions = true }: { showActions?: boolean }) {
  const {
    selectedKey,
    selectedType,
    selectedKeys,
    selectionCount,
    select,
    deselect,
    shouldFocusInspector,
    consumeFocusInspector,
  } = useSelection();
  const definition = useDefinition();
  const dispatch = useDispatch();
  const project = useProject();
  const keyInputRef = useRef<HTMLInputElement>(null);

  const items = definition.items || [];
  const lookup = useMemo(() => buildDefLookup(items as any), [items]);
  const found = selectedKey ? lookup.get(selectedKey) : null;
  const itemPath = found?.path ?? '';

  const handleRename = useCallback((originalPath: string, inputEl: HTMLInputElement) => {
    const nextKey = inputEl.value;
    const currentKey = originalPath.split('.').pop();
    if (nextKey && nextKey !== currentKey) {
      dispatch({
        type: 'definition.renameItem',
        payload: { path: originalPath, newKey: nextKey },
      });
      const parentPath = originalPath.split('.').slice(0, -1).join('.');
      const nextPath = parentPath ? `${parentPath}.${nextKey}` : nextKey;
      select(nextPath, selectedType ?? 'field');
    }
  }, [dispatch, select, selectedType]);

  const handleDelete = useCallback((path: string) => {
    dispatch({ type: 'definition.deleteItem', payload: { path } });
  }, [dispatch]);

  const handleDuplicate = useCallback((path: string) => {
    dispatch({ type: 'definition.duplicateItem', payload: { path } });
  }, [dispatch]);

  useEffect(() => {
    const input = keyInputRef.current;
    if (!input || !itemPath) return;

    const onBlur = () => handleRename(itemPath, input);
    input.addEventListener('blur', onBlur);
    return () => input.removeEventListener('blur', onBlur);
  }, [itemPath, handleRename]);

  useEffect(() => {
    const input = keyInputRef.current;
    if (!shouldFocusInspector || !input || !itemPath) return;
    input.focus();
    input.select();
    consumeFocusInspector();
  }, [shouldFocusInspector, itemPath, consumeFocusInspector]);

  if (selectionCount > 1) {
    return (
      <MultiSelectSummary
        selectionCount={selectionCount}
        selectedKeys={selectedKeys}
        project={project}
        deselect={deselect}
      />
    );
  }

  if (!selectedKey) {
    return <DefinitionProperties definition={definition} dispatch={dispatch} />;
  }

  if (isLayoutId(selectedKey)) {
    return <LayoutProperties layoutId={selectedKey} dispatch={dispatch} deselect={deselect} />;
  }

  if (!found) {
    return (
      <div className="p-4 text-[13px] text-muted font-ui">
        Item not found: {selectedKey}
      </div>
    );
  }

  const binds = bindsFor(definition.binds as any, found.path);
  const shapes = shapesFor((definition as any).shapes, found.path);

  return (
    <SelectedItemProperties
      item={found.item}
      path={found.path}
      selectedType={selectedType}
      binds={binds}
      shapes={shapes}
      keyInputRef={keyInputRef}
      showActions={showActions}
      dispatch={dispatch}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
    />
  );
}
