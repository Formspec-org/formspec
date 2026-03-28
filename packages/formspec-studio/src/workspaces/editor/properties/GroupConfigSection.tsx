/** @filedesc Properties panel section for group config: repeatable toggle and min/max repeat counts. */
import { Section } from '../../../components/ui/Section';
import { HelpTip } from '../../../components/ui/HelpTip';
import { propertyHelp, type Project } from '@formspec-org/studio-core';
import type { FormItem } from '@formspec-org/types';

function parseRepeatValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function GroupConfigSection({
  path,
  item,
  project,
}: {
  path: string;
  item: FormItem;
  project: Project;
}) {
  return (
    <Section title="Group Config">
      <div className="flex items-center gap-2 mb-2">
        <input
          id={`${path}-repeatable`}
          type="checkbox"
          aria-label="Repeatable"
          className="accent-accent"
          defaultChecked={!!item.repeatable}
          onChange={(event) => {
            project.updateItem(path, { repeatable: event.currentTarget.checked });
          }}
        />
        <label htmlFor={`${path}-repeatable`} className="font-mono text-[10px] uppercase tracking-wider text-ink">
          <HelpTip text={propertyHelp.repeatable}>Repeatable</HelpTip>
        </label>
      </div>

      {item.repeatable && (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider block text-ink" htmlFor={`${path}-min-repeat`}>
              <HelpTip text={propertyHelp.minRepeat}>Min Repeat</HelpTip>
            </label>
            <input
              id={`${path}-min-repeat`}
              type="number"
              min={0}
              aria-label="Min Repeat"
              className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
              defaultValue={item.minRepeat ?? ''}
              onBlur={(event) => {
                project.updateItem(path, { minRepeat: parseRepeatValue(event.currentTarget.value) });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider block text-ink" htmlFor={`${path}-max-repeat`}>
              <HelpTip text={propertyHelp.maxRepeat}>Max Repeat</HelpTip>
            </label>
            <input
              id={`${path}-max-repeat`}
              type="number"
              min={0}
              aria-label="Max Repeat"
              className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
              defaultValue={item.maxRepeat ?? ''}
              onBlur={(event) => {
                project.updateItem(path, { maxRepeat: parseRepeatValue(event.currentTarget.value) });
              }}
            />
          </div>
        </div>
      )}
    </Section>
  );
}
