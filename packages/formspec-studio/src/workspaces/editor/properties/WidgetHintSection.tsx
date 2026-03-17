/** @filedesc Properties panel section for selecting the widget hint when multiple widgets are compatible. */
import { Section } from '../../../components/ui/Section';
import { HelpTip } from '../../../components/ui/HelpTip';
import {
  compatibleWidgets,
  componentForWidgetHint,
  propertyHelp,
} from '../../../lib/field-helpers';
import type { Project } from 'formspec-studio-core';

export function WidgetHintSection({
  path,
  item,
  project,
}: {
  path: string;
  item: any;
  project: Project;
}) {
  const widgets = compatibleWidgets(item.type, item.dataType);
  const defaultWidget = widgets[0] ?? '';
  const hintWidget = componentForWidgetHint((item.presentation as any)?.widgetHint);
  const treeWidget = project.componentFor(item.key)?.component as string | undefined;
  const currentWidget = hintWidget || treeWidget || defaultWidget;

  if (widgets.length < 2) return null;

  return (
    <Section title="Widget">
      <div className="space-y-1.5 mb-2">
        <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-widget`}>
          <HelpTip text={propertyHelp.widgetHint}>Widget</HelpTip>
        </label>
        <select
          id={`${path}-widget`}
          aria-label="Widget"
          className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
          value={currentWidget}
          onChange={(event) => {
            const widget = event.currentTarget.value || null;
            project.updateItem(path, { widget });
          }}
        >
          <option value="">Default</option>
          {widgets.map((widget) => (
            <option key={widget} value={widget}>
              {widget}
            </option>
          ))}
        </select>
      </div>
    </Section>
  );
}
