/** @filedesc Manage view compositor — shared resources and cross-cutting logic views. */
import { useMemo, useState, useCallback, useRef, createRef, type RefObject } from 'react';
import { normalizeBindsView, buildDefLookup } from '@formspec-org/studio-core';
import { useDefinition } from '../../state/useDefinition';
import { useSelection } from '../../state/useSelection';
import { VariablesSection } from '../logic/VariablesSection';
import { BindsSection } from '../logic/BindsSection';
import { ShapesSection } from '../logic/ShapesSection';
import { FilterBar } from '../logic/FilterBar';
import { OptionSets } from '../shared/OptionSets';
import { DataSources } from '../shared/DataSources';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { HelpTip } from '../../components/ui/HelpTip';

const SECTIONS = [
  { id: 'option-sets', label: 'Options' },
  { id: 'variables', label: 'Values' },
  { id: 'data-sources', label: 'Data' },
  { id: 'binds-index', label: 'Behaviors' },
  { id: 'shapes', label: 'Rules' },
] as const;

function SectionNav({ sectionRefs }: { sectionRefs: Record<string, RefObject<HTMLElement | null>> }) {
  return (
    <nav aria-label="Manage sections" className="flex items-center gap-1.5 flex-wrap" data-testid="manage-section-nav">
      {SECTIONS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => sectionRefs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="px-2.5 py-1 text-[12px] font-medium rounded-full text-muted hover:bg-subtle hover:text-ink transition-colors"
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function ManagePillar({
  id,
  title,
  subtitle,
  helpText,
  children,
  accentColor = 'bg-accent',
  sectionRef,
}: {
  id: string;
  title: string;
  subtitle: string;
  helpText: string;
  children: React.ReactNode;
  accentColor?: string;
  sectionRef?: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section
      id={id}
      ref={sectionRef as RefObject<HTMLDivElement>}
      data-testid={`manage-section-${id}`}
      className="mb-8 last:mb-0 scroll-mt-20"
    >
      <header className="mb-6">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex items-center gap-3 mb-1 cursor-pointer group"
        >
          <div className={`w-1 h-5 rounded-full ${accentColor}`} />
          <h3 className="text-[14px] font-semibold tracking-tight text-ink">
            {title}
          </h3>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            className={`text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3.5 L5 6.5 L8 3.5" />
          </svg>
        </button>
        <div className="flex items-center gap-2 pl-4">
          <HelpTip text={helpText}>
            <span className="text-[12px] text-muted italic tracking-tight">{subtitle}</span>
          </HelpTip>
        </div>
      </header>
      <div
        className="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        data-expanded={open}
      >
        <div className="overflow-hidden" {...(!open ? { inert: true } : {})}>
          <div className="pl-6 border-l border-border/60 ml-0.5 mt-4">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

const sectionIds = SECTIONS.map(s => s.id);

export function ManageView() {
  const definition = useDefinition();
  const { select } = useSelection();
  const sectionRefs = useRef<Record<string, RefObject<HTMLElement | null>>>(
    Object.fromEntries(sectionIds.map(id => [id, createRef<HTMLElement>()]))
  ).current;
  const [activeBindFilter, setActiveBindFilter] = useState<
    'required' | 'relevant' | 'calculate' | 'constraint' | 'readonly' | 'pre-populate' | null
  >(null);

  const binds = normalizeBindsView(definition?.binds, definition?.items ?? []);
  const shapes = Array.isArray(definition?.shapes)
    ? definition.shapes.map((s: any) => ({ name: s.id, ...s }))
    : [];
  const variables = Array.isArray(definition?.variables) ? definition.variables : [];

  const fieldPaths = useMemo(() => {
    if (!definition?.items) return [];
    const lookup = buildDefLookup(definition.items);
    return Array.from(lookup.keys());
  }, [definition?.items]);

  const handleSelectPath = useCallback((path: string) => {
    select(path, 'field', { tab: 'editor' });
    window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', {
      detail: { tab: 'Editor', view: 'build' },
    }));
  }, [select]);

  return (
    <WorkspacePage className="overflow-y-auto" maxWidth="max-w-[880px]">
      <WorkspacePageSection className="flex-1 py-8">
        <div className="mb-6">
          <SectionNav sectionRefs={sectionRefs} />
        </div>

        <ManagePillar
          id="option-sets"
          title="Option Sets"
          subtitle="Shared choice lists referenced by fields"
          helpText="Reusable lists of options that multiple choice/multiChoice fields can reference."
          accentColor="bg-logic"
          sectionRef={sectionRefs['option-sets']}
        >
          <OptionSets />
        </ManagePillar>

        <ManagePillar
          id="variables"
          title="Calculated Values"
          subtitle="Form-level constants and expressions"
          helpText="Global variables and reusable FEL expressions. Reference them anywhere using the @ prefix."
          accentColor="bg-accent"
          sectionRef={sectionRefs['variables']}
        >
          <VariablesSection variables={variables} />
        </ManagePillar>

        <ManagePillar
          id="data-sources"
          title="Data Sources"
          subtitle="External data references for lookups"
          helpText="External data sources (Instances) that FEL expressions @instance('name') can reference."
          accentColor="bg-green"
          sectionRef={sectionRefs['data-sources']}
        >
          <DataSources />
        </ManagePillar>

        <ManagePillar
          id="binds-index"
          title="Field Behaviors"
          subtitle="All behavior rules across the form"
          helpText="Cross-cutting index of all field-level behavior rules. Click a row to jump to the field in Build view."
          accentColor="bg-logic"
          sectionRef={sectionRefs['binds-index']}
        >
          <div className="mb-6">
            <FilterBar binds={binds} activeFilter={activeBindFilter} onFilterSelect={setActiveBindFilter} />
          </div>
          <BindsSection
            binds={binds}
            activeFilter={activeBindFilter}
            allPaths={fieldPaths}
            onSelectPath={handleSelectPath}
          />
        </ManagePillar>

        <ManagePillar
          id="shapes"
          title="Validation Rules"
          subtitle="Cross-field constraints"
          helpText="Advanced form-wide constraints that validate relationships between fields."
          accentColor="bg-error"
          sectionRef={sectionRefs['shapes']}
        >
          <ShapesSection shapes={shapes} />
        </ManagePillar>
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
