/** @filedesc Data workspace tab composing OutputBlueprint, DataSources, and OptionSets panels. */
import { OutputBlueprint } from '../../components/blueprint/OutputBlueprint';
import { DataSources } from '../shared/DataSources';
import { OptionSets } from '../shared/OptionSets';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { Pillar } from '../shared/Pillar';
import { SectionFilterBar } from '../shared/SectionFilterBar';
import { useControllableState } from '../../hooks/useControllableState';

const sectionTabs = [
  { id: 'all', label: 'All Data' },
  { id: 'structure', label: 'Structure' },
  { id: 'tables', label: 'Tables' },
  { id: 'sources', label: 'Sources' },
] as const;

export type DataSectionFilter = typeof sectionTabs[number]['id'];

interface DataTabProps {
  sectionFilter?: DataSectionFilter;
  onSectionFilterChange?: (filter: DataSectionFilter) => void;
}

export function DataTab({ sectionFilter: controlledFilter, onSectionFilterChange }: DataTabProps = {}) {
  const [sectionFilter, setSectionFilter] = useControllableState(controlledFilter, onSectionFilterChange, 'all' as DataSectionFilter);

  const showStructure = sectionFilter === 'all' || sectionFilter === 'structure';
  const showTables = sectionFilter === 'all' || sectionFilter === 'tables';
  const showSources = sectionFilter === 'all' || sectionFilter === 'sources';

  return (
    <WorkspacePage className="overflow-y-auto">
      <WorkspacePageSection padding="px-7" className="sticky top-0 bg-bg-default/80 backdrop-blur-md z-20 pt-6 pb-2 border-b border-border/40">
        <SectionFilterBar
          tabs={sectionTabs}
          activeTab={sectionFilter}
          onTabChange={setSectionFilter}
          ariaLabel="Data section filter"
        />
      </WorkspacePageSection>

      <WorkspacePageSection className="flex-1 py-10">
        {showStructure && (
          <Pillar
            title="Submission Structure"
            subtitle="The shape of the form's final output"
            helpText="This is the JSON document structure that will be generated and submitted when the form is completed."
            accentColor="bg-accent"
          >
            <OutputBlueprint />
          </Pillar>
        )}

        {showTables && (
          <Pillar
            title="Lookup Tables"
            subtitle="Shared lists of choices and options"
            helpText="Reusable lists of options that multiple fields can reference (Option Sets)."
            accentColor="bg-logic"
          >
            <OptionSets />
          </Pillar>
        )}

        {showSources && (
          <Pillar
            title="External Sources"
            subtitle="Data loaded from external APIs or documents"
            helpText="External data sources (Instances) that FEL expressions @instance('name') can reference."
            accentColor="bg-green"
          >
            <DataSources />
          </Pillar>
        )}

      </WorkspacePageSection>
    </WorkspacePage>
  );
}
