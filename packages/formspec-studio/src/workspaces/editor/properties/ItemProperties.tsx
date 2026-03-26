/** @filedesc Root properties panel that routes to definition, layout, multi-select, or item properties. */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { bindsFor, shapesFor, buildDefLookup, isLayoutId } from '../../../lib/field-helpers';
import { useDefinition } from '../../../state/useDefinition';
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
  const project = useProject();
  const keyInputRef = useRef<HTMLInputElement>(null);

  const items = definition.items || [];
  const lookup = useMemo(() => buildDefLookup(items), [items]);
  const found = selectedKey ? lookup.get(selectedKey) : null;
  const itemPath = found?.path ?? '';

  const handleRename = useCallback((originalPath: string, inputEl: HTMLInputElement) => {
    const nextKey = inputEl.value;
    const currentKey = originalPath.split('.').pop();
    if (nextKey && nextKey !== currentKey) {
      project.renameItem(originalPath, nextKey);
      const parentPath = originalPath.split('.').slice(0, -1).join('.');
      const nextPath = parentPath ? `${parentPath}.${nextKey}` : nextKey;
      select(nextPath, selectedType ?? 'field');
    }
  }, [project, select, selectedType]);

  const handleDelete = useCallback((path: string) => {
    project.removeItem(path);
  }, [project]);

  const handleDuplicate = useCallback((path: string) => {
    project.copyItem(path);
  }, [project]);

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
    return <DefinitionProperties definition={definition} project={project} />;
  }

  if (isLayoutId(selectedKey)) {
    return <LayoutProperties layoutId={selectedKey} project={project} deselect={deselect} />;
  }

  if (!found) {
    return (
      <div className="p-4 text-[13px] text-muted font-ui">
        Item not found: {selectedKey}
      </div>
    );
  }

  const binds = bindsFor(definition.binds, found.path);
  const shapes = shapesFor(definition.shapes, found.path);

  return (
    <SelectedItemProperties
      item={found.item}
      path={found.path}
      selectedType={selectedType}
      binds={binds}
      shapes={shapes}
      keyInputRef={keyInputRef}
      showActions={showActions}
      project={project}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
    />
  );
}
