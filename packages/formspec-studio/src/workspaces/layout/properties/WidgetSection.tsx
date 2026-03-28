/** @filedesc Layout properties section for selecting the component type (Tier 3 override). */
import { Section } from '../../../components/ui/Section';
import { compatibleWidgets, type Project } from '@formspec-org/studio-core';

export function WidgetSection({
  itemKey,
  itemType,
  itemDataType,
  currentComponent,
  project,
}: {
  itemKey: string;
  itemType: string;
  itemDataType?: string;
  currentComponent?: string;
  project: Project;
}) {
  const widgets = compatibleWidgets(itemType, itemDataType);
  if (widgets.length < 2) return null;

  return (
    <Section title="Widget">
      <div className="space-y-1.5 mb-2">
        <label
          className="font-mono text-[10px] text-muted uppercase tracking-wider block"
          htmlFor={`layout-widget-${itemKey}`}
        >
          Component Type
        </label>
        <select
          id={`layout-widget-${itemKey}`}
          aria-label="Component Type"
          className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
          value={currentComponent || ''}
          onChange={(event) => {
            const widget = event.currentTarget.value || null;
            if (widget) {
              project.updateItem(itemKey, { widget });
            }
          }}
        >
          <option value="">Default</option>
          {widgets.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </div>
    </Section>
  );
}
