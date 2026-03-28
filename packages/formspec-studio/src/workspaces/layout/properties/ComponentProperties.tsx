/** @filedesc Layout workspace properties panel — shows only Tier 2/3 (presentation + component) properties. */
import { useMemo, useState, useEffect } from 'react';
import { Section } from '../../../components/ui/Section';
import { PropertyRow } from '../../../components/ui/PropertyRow';
import { InlineExpression } from '../../../components/ui/InlineExpression';
import { useDefinition } from '../../../state/useDefinition';
import { useProject } from '../../../state/useProject';
import { useSelection } from '../../../state/useSelection';
import {
  buildDefLookup,
  findComponentNodeById,
  isLayoutId,
  nodeIdFromLayoutId,
} from '@formspec-org/studio-core';
import { AppearanceSection } from './AppearanceSection';
import { WidgetSection } from './WidgetSection';
import { LayoutSection } from './LayoutSection';
import { ContainerSection } from './ContainerSection';

const CONTAINER_TYPES = new Set(['Stack', 'Card', 'Grid', 'Panel', 'Accordion', 'Collapsible']);

function TextPropertyInput({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <PropertyRow label={label}>
      <input
        aria-label={label}
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className="w-full rounded-[4px] border border-border bg-surface px-2 py-1 text-[12px] font-mono text-ink outline-none transition-colors placeholder:text-muted/40 focus:border-accent"
      />
    </PropertyRow>
  );
}

export function ComponentProperties() {
  const { deselect, selectedKeyForTab, selectedTypeForTab } = useSelection();
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

  if (isLayoutId(selectedKey)) {
    const nodeId = nodeIdFromLayoutId(selectedKey);
    const layoutNode = findComponentNodeById(project.component.tree as Record<string, unknown> | undefined, nodeId);

    if (!layoutNode) {
      return (
        <div className="p-4 text-[13px] text-muted font-ui">
          Item not found: {selectedKey}
        </div>
      );
    }

    const componentType = (layoutNode.component as string) ?? 'Layout';
    const nodeProps = layoutNode;
    const componentWhen = (nodeProps.when as string) ?? '';
    const accessibility = (nodeProps.accessibility as Record<string, unknown> | undefined) ?? {};

    return (
      <div className="h-full flex flex-col bg-surface overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
          <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">Component</h2>
          <div className="font-mono text-[12px] text-muted truncate">
            {componentType}
            <span className="ml-2 text-accent text-[11px]">{nodeId}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1">
          <Section title="Actions">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="layout-properties-unwrap"
                onClick={() => {
                  project.unwrapLayoutNode(nodeId);
                  deselect();
                }}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                Unwrap
              </button>
              <button
                type="button"
                data-testid="layout-properties-delete"
                onClick={() => {
                  project.deleteLayoutNode(nodeId);
                  deselect();
                }}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-error hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/70"
              >
                Remove from Tree
              </button>
            </div>
          </Section>

          <ContainerSection componentType={componentType} nodeProps={nodeProps} />

          <Section title="Visual Condition">
            <div className="space-y-1.5 mb-2">
              <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">
                Show When
              </label>
              <InlineExpression
                value={componentWhen}
                onSave={(value) => project.setComponentWhen(selectedKey, value)}
                placeholder="Always visible"
              />
            </div>
          </Section>

          <Section title="Accessibility">
            <TextPropertyInput
              label="ARIA Label"
              value={(accessibility.description as string) ?? ''}
              placeholder="Optional label override"
              onCommit={(value) => project.setComponentAccessibility(selectedKey, 'description', value)}
            />
            <TextPropertyInput
              label="Role"
              value={(accessibility.role as string) ?? ''}
              placeholder="Optional role override"
              onCommit={(value) => project.setComponentAccessibility(selectedKey, 'role', value)}
            />
          </Section>
        </div>
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
  const accessibility = (nodeProps.accessibility as Record<string, unknown> | undefined) ?? {};

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
              onSave={(value) => project.setComponentWhen(selectedKey, value)}
              placeholder="Always visible"
            />
          </div>
        </Section>

        <Section title="Accessibility">
          <TextPropertyInput
            label="ARIA Label"
            value={(accessibility.description as string) ?? ''}
            placeholder="Optional label override"
            onCommit={(value) => project.setComponentAccessibility(selectedKey, 'description', value)}
          />
          <TextPropertyInput
            label="Role"
            value={(accessibility.role as string) ?? ''}
            placeholder="Optional role override"
            onCommit={(value) => project.setComponentAccessibility(selectedKey, 'role', value)}
          />
        </Section>
      </div>
    </div>
  );
}
