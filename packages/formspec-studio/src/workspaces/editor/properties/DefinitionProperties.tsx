/** @filedesc Properties panel shown when no item is selected; edits top-level form definition metadata. */
import { Section } from '../../../components/ui/Section';
import { PropertyRow } from '../../../components/ui/PropertyRow';
import { Project } from '@formspec-org/studio-core';
import type { FormDefinition } from '@formspec-org/types';

export function DefinitionProperties({
  definition,
  project,
}: {
  definition: FormDefinition;
  project: Project;
}) {
  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="border-b border-border/80 bg-surface px-5 py-4 shrink-0">
        <h2 className="text-[17px] font-semibold text-ink tracking-tight font-ui">Form Properties</h2>
        <div className="text-[13px] text-muted truncate">
          {definition.url || 'Untitled'}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 md:px-5">
        <Section title="Identity">
          <div className="mb-3 space-y-2">
            <label className="block text-[12px] font-medium text-muted" htmlFor="def-title">
              Title
            </label>
            <input
              id="def-title"
              type="text"
              aria-label="Title"
              className="w-full rounded-[12px] border border-border/80 bg-surface px-3 py-2 text-[13px] outline-none transition-colors focus:border-accent focus-ring"
              defaultValue={definition.title ?? ''}
              onBlur={(event) => {
                project.setMetadata({ title: event.currentTarget.value || null });
              }}
            />
          </div>
          <PropertyRow label="Version">{definition.version ?? ''}</PropertyRow>
          <PropertyRow label="Status">{definition.status ?? ''}</PropertyRow>
        </Section>
      </div>
    </div>
  );
}
