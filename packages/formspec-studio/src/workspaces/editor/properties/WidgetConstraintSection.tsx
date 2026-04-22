/** @filedesc Properties panel section for widget constraint properties (min, max, step, date ranges) with automatic bind constraint sync. */
import { useCallback } from 'react';
import { Section } from '../../../components/ui/Section';
import {
  getWidgetConstraintProps,
  type Project,
  type WidgetConstraintState,
  type NumericConstraintValues,
  type DateConstraintValues,
} from '@formspec-org/studio-core';

function currentValues(state: WidgetConstraintState): Record<string, string | number | null | undefined> {
  if (state.type === 'date') {
    const d = state.dateValues;
    return { min: d.min, max: d.max };
  }
  const n = state.numericValues;
  return { min: n.min, max: n.max, step: n.step };
}

export function WidgetConstraintSection({
  path,
  project,
  widgetState,
}: {
  path: string;
  project: Project;
  widgetState: WidgetConstraintState;
}) {
  const constraintProps = getWidgetConstraintProps(widgetState.component ?? '');
  if (constraintProps.length === 0) return null;

  const isDate = widgetState.type === 'date';
  const vals = currentValues(widgetState);

  const handleBlur = useCallback((prop: string, propType: 'number' | 'date') => {
    return (event: React.FocusEvent<HTMLInputElement>) => {
      const raw = event.currentTarget.value.trim();
      let nextValue: string | number | null;
      if (propType === 'number') {
        if (!raw) {
          nextValue = null;
        } else {
          const parsed = Number(raw);
          nextValue = Number.isNaN(parsed) ? null : parsed;
        }
      } else {
        nextValue = raw || null;
      }

      if (isDate) {
        const partial: Partial<DateConstraintValues> = { [prop]: nextValue };
        project.setWidgetConstraints(path, partial);
      } else {
        const partial: Partial<NumericConstraintValues> = { [prop]: nextValue };
        project.setWidgetConstraints(path, partial);
      }
    };
  }, [path, project, isDate]);

  return (
    <Section title="Range Constraints">
      <div className="space-y-1.5 mb-1">
        {widgetState.hasCustomConstraint && (
          <div className="text-[11px] text-muted italic mb-2" data-testid="widget-constraint-custom-notice">
            Custom constraint active — widget range edits will not override it.
          </div>
        )}
        {constraintProps.map((prop) => {
          const currentValue = vals[prop.key];
          const inputType = prop.type === 'date' ? 'date' : 'number';
          return (
            <div key={prop.key} className="space-y-1.5 mb-2">
              <label
                className="font-mono text-[10px] text-ink/70 uppercase tracking-wider block"
                htmlFor={`${path}-wc-${prop.key}`}
              >
                {prop.label}
              </label>
              <input
                id={`${path}-wc-${prop.key}`}
                key={`${path}-wc-${prop.key}-${currentValue ?? ''}`}
                type={inputType}
                aria-label={prop.label}
                className="w-full h-8 px-2.5 text-[13px] border border-border/80 rounded-[6px] bg-surface outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                defaultValue={currentValue != null ? String(currentValue) : ''}
                onBlur={handleBlur(prop.key, prop.type)}
                placeholder={prop.type === 'date' ? 'YYYY-MM-DD' : '\u2014'}
                step={prop.type === 'number' ? 'any' : undefined}
              />
            </div>
          );
        })}
        {widgetState.isManaged && (
          <div className="text-[10px] text-muted/70 font-mono mt-1" data-testid="widget-constraint-managed">
            Constraint: <code className="bg-bg-default px-1 rounded">{project.bindFor(path)?.constraint as string}</code>
          </div>
        )}
      </div>
    </Section>
  );
}
