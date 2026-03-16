import { Section } from '../../../components/ui/Section';
import { PropertyRow } from '../../../components/ui/PropertyRow';
import type { Project } from 'formspec-studio-core';

export function DefinitionProperties({
  definition,
  project,
}: {
  definition: any;
  project: Project;
}) {
  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
        <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">Form Properties</h2>
        <div className="font-mono text-[12px] text-muted truncate">
          {definition.url || 'Untitled'}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1">
        <Section title="Identity">
          <div className="space-y-1.5 mb-2">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor="def-title">
              Title
            </label>
            <input
              id="def-title"
              type="text"
              aria-label="Title"
              className="w-full px-2 py-1 text-[13px] border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
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
