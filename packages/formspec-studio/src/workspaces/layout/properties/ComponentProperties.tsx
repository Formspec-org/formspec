/** @filedesc Layout workspace properties panel — shows only Tier 2/3 (presentation + component) properties. */
import { useMemo } from 'react';
import { Section } from '../../../components/ui/Section';
import { PropertyRow } from '../../../components/ui/PropertyRow';
import { InlineExpression } from '../../../components/ui/InlineExpression';
import { useDefinition } from '../../../state/useDefinition';
import { useProject } from '../../../state/useProject';
import { useSelection } from '../../../state/useSelection';
import { buildDefLookup } from '../../../lib/field-helpers';
import { AppearanceSection } from './AppearanceSection';
import { WidgetSection } from './WidgetSection';
import { LayoutSection } from './LayoutSection';
import { ContainerSection } from './ContainerSection';

const CONTAINER_TYPES = new Set(['Stack', 'Card', 'Grid', 'Panel', 'Accordion', 'Collapsible']);

export function ComponentProperties() {
  const { selectedKeyForTab, selectedTypeForTab } = useSelection();
  const definition = useDefinition();
  const project = useProject();

  const selectedKey = selectedKeyForTab('layout');
  const selectedType = selectedTypeForTab('layout');

  const items = definition?.items ?? [];
  const lookup = useMemo(() => buildDefLookup(items), [items]);

  if (!selectedKey || !selectedType) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-[13px] text-muted text-center font-ui">
          Select a component in the Layout canvas
        </p>
      </div>
    );
  }

  const found = lookup.get(selectedKey);
  if (!found) {
    return (
      <div className="p-4 text-[13px] text-muted font-ui">
        Item not found: {selectedKey}
      </div>
    );
  }

  const { item } = found;
  const itemKey = item.key;
  const dataType = item.dataType as string | undefined;
  const componentNode = project.componentFor(itemKey) as Record<string, unknown> | undefined;
  const componentType = (componentNode?.component as string) ?? '';
  const nodeProps = componentNode ?? {};
  const isField = item.type === 'field';
  const isGroup = item.type === 'group';
  const isDisplay = item.type === 'display';
  const isContainer = CONTAINER_TYPES.has(componentType);

  // Component `when` expression (Tier 3 visual condition, NOT bind `relevant`)
  const componentWhen = (nodeProps.when as string) ?? '';

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
        <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">Component</h2>
        <div className="font-mono text-[12px] text-muted truncate">
          {(item.label as string) || itemKey}
          {componentType && (
            <span className="ml-2 text-accent text-[11px]">{componentType}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1">
        {/* Widget selector for fields with multiple compatible components */}
        {isField && (
          <WidgetSection
            itemKey={itemKey}
            itemType={item.type}
            itemDataType={dataType}
            currentComponent={componentType}
            project={project}
          />
        )}

        {/* Container properties for container components */}
        {(isGroup || isContainer) && componentType && (
          <ContainerSection componentType={componentType} nodeProps={nodeProps} />
        )}

        {/* Appearance (theme cascade + style overrides) */}
        <AppearanceSection
          itemKey={itemKey}
          itemType={item.type}
          itemDataType={dataType}
        />

        {/* Layout positioning (grid placement) */}
        {(isField || isDisplay) && (
          <LayoutSection nodeProps={nodeProps} />
        )}

        {/* Visual Condition — component-level `when`, NOT bind `relevant` */}
        <Section title="Visual Condition">
          <div className="space-y-1.5 mb-2">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">
              Show When
            </label>
            <InlineExpression
              value={componentWhen}
              onSave={() => {
                // Will be wired to component.setNodeProperty in a future task
              }}
              placeholder="Always visible"
            />
          </div>
        </Section>

        {/* Accessibility stub */}
        <Section title="Accessibility">
          <p className="text-[11px] text-muted font-ui">
            ARIA labels and roles will be configurable here.
          </p>
        </Section>
      </div>
    </div>
  );
}
