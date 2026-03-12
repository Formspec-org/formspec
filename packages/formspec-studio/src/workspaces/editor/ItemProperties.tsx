import { useCallback, useRef, useEffect } from 'react';
import { useSelection } from '../../state/useSelection';
import { useDefinition } from '../../state/useDefinition';
import { useDispatch } from '../../state/useDispatch';
import { flatItems, bindsFor, arrayBindsFor, dataTypeInfo, shapesFor } from '../../lib/field-helpers';
import { Section } from '../../components/ui/Section';
import { PropertyRow } from '../../components/ui/PropertyRow';
import { BindCard } from '../../components/ui/BindCard';
import { ShapeCard } from '../../components/ui/ShapeCard';
import { humanizeFEL } from '../../lib/humanize';

/**
 * Displays and edits properties for the currently selected item.
 * High-density technical inspector.
 */
export function ItemProperties({ showActions = true }: { showActions?: boolean }) {
  const { selectedKey, selectedType, select, shouldFocusInspector, consumeFocusInspector } = useSelection();
  const definition = useDefinition();
  const dispatch = useDispatch();
  const keyInputRef = useRef<HTMLInputElement>(null);

  const handleRename = useCallback(
    (originalPath: string, inputEl: HTMLInputElement) => {
      const newKey = inputEl.value;
      const currentKey = originalPath.split('.').pop();
      if (newKey && newKey !== currentKey) {
        dispatch({
          type: 'definition.renameItem',
          payload: { path: originalPath, newKey },
        });
        const parentPath = originalPath.split('.').slice(0, -1).join('.');
        const nextPath = parentPath ? `${parentPath}.${newKey}` : newKey;
        select(nextPath, selectedType ?? 'field');
      }
    },
    [dispatch, select, selectedType],
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

  useEffect(() => {
    if (!shouldFocusInspector) return;
    const el = keyInputRef.current;
    if (!el || !itemPath) return;
    el.focus();
    el.select();
    consumeFocusInspector();
  }, [shouldFocusInspector, itemPath, consumeFocusInspector]);

  if (!selectedKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted p-8">
        <div className="w-11 h-11 border-1.5 border-dashed border-border rounded-[4px] flex items-center justify-center mb-3 opacity-50 text-lg">
          ⬡
        </div>
        <div className="text-[14px] text-center leading-relaxed font-ui">
          Select an item<br />to inspect
        </div>
      </div>
    );
  }

  if (!found) {
    return (
      <div className="p-4 text-[13px] text-muted font-ui">
        Item not found: {selectedKey}
      </div>
    );
  }

  const { item, path } = found;
  const rawBinds = definition.binds;
  const binds = Array.isArray(rawBinds)
    ? arrayBindsFor(rawBinds as any[], path)
    : bindsFor(rawBinds as any, path);
  
  const shapes = shapesFor((definition as any).shapes, path);
  const dtInfo = item.dataType ? dataTypeInfo(item.dataType) : null;
  const currentKey = path.split('.').pop() || path;
  const rawChoiceOptions = (item as any).options ?? (item as any).choices;
  const choiceOptions = Array.isArray(rawChoiceOptions) ? (rawChoiceOptions as Array<{ value: string; label?: string }>) : [];

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {/* Panel Header */}
      <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {dtInfo && (
            <div className={`w-5.5 h-5.5 rounded-[3px] bg-subtle flex items-center justify-center font-mono font-bold text-[10px] ${dtInfo.color}`}>
              {dtInfo.icon}
            </div>
          )}
          <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">Properties</h2>
        </div>
        <div className="font-mono text-[12px] text-muted truncate">
          {(item.label as string) || currentKey}
        </div>
      </div>

      {/* Inspector Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1">
        <Section title="Identity">
          <div className="space-y-1.5 mb-2">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">Key</label>
            <input
              key={itemPath}
              ref={keyInputRef}
              type="text"
              aria-label="Key"
              className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
              defaultValue={currentKey}
            />
          </div>
          <div className="space-y-1.5 mb-2">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">Label</label>
            <input
              key={`${itemPath}-label`}
              type="text"
              aria-label="Label"
              className="w-full px-2 py-1 text-[13px] border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
              defaultValue={(item.label as string) || ''}
              onBlur={(event) => {
                dispatch({
                  type: 'definition.setItemProperty',
                  payload: { path, property: 'label', value: event.currentTarget.value || null },
                });
              }}
            />
          </div>
          <PropertyRow label="Type">{selectedType || item.type}</PropertyRow>
          {dtInfo && (
            <PropertyRow label="DataType" color={dtInfo.color}>
              <span className="mr-1">{dtInfo.icon}</span>
              {dtInfo.label}
            </PropertyRow>
          )}
          {typeof item.semanticType === 'string' && <PropertyRow label="Semantic" color="text-logic">{item.semanticType}</PropertyRow>}
        </Section>

        {item.type === 'field' && !!(item.currency || item.precision != null || item.prefix || item.suffix) && (
          <Section title="Field Config">
            {typeof item.currency === 'string' && <PropertyRow label="Currency">{item.currency}</PropertyRow>}
            {typeof item.precision === 'number' && <PropertyRow label="Precision">{item.precision}</PropertyRow>}
            {typeof item.prefix === 'string' && <PropertyRow label="Prefix">"{item.prefix}"</PropertyRow>}
            {typeof item.suffix === 'string' && <PropertyRow label="Suffix">"{item.suffix}"</PropertyRow>}
          </Section>
        )}

        {item.type === 'field' && choiceOptions.length > 0 && (
          <Section title="Options">
            <div className="space-y-2">
              {choiceOptions.map((option, index) => (
                <div key={`${option.value}-${index}`} className="flex items-center justify-between gap-3 rounded-[4px] border border-border bg-subtle/40 px-2 py-1.5">
                  <span className="font-mono text-[12px] text-ink">{option.value}</span>
                  <span className="text-[12px] text-muted">{option.label ?? option.value}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {Object.keys(binds).length > 0 && (
          <Section title="Behavior Rules">
            <div className="space-y-1">
              {Object.entries(binds).map(([type, expr]) => (
                <BindCard
                  key={type}
                  bindType={type}
                  expression={expr}
                  humanized={humanizeFEL(expr)}
                />
              ))}
            </div>
          </Section>
        )}

        {shapes.length > 0 && (
          <Section title="Validation Shapes">
            <div className="space-y-1">
              {shapes.map((sh, i) => (
                <ShapeCard
                  key={i}
                  name={sh.name}
                  severity={sh.severity}
                  constraint={sh.constraint}
                  message={sh.message as string}
                  code={sh.code as string}
                />
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Action Footer */}
      {showActions && (
        <div className="p-3.5 border-t border-border bg-surface shrink-0 flex gap-2">
          <button
            className="flex-1 py-1.5 border border-border rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-subtle transition-colors cursor-pointer"
            onClick={() => handleDuplicate(path)}
          >
            Duplicate
          </button>
          <button
            className="flex-1 py-1.5 border border-error/20 rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest text-error hover:bg-error/5 transition-colors cursor-pointer"
            onClick={() => handleDelete(path)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
