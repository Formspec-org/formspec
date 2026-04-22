/** @filedesc Mapping workspace tab composing Blueprint, Rules, Adapter, and Preview sections with a FilterBar. */
import { MappingConfig } from './MappingConfig';
import { RuleEditor } from './RuleEditor';
import { AdapterConfig } from './AdapterConfig';
import { MappingPreview } from './MappingPreview';
import { MappingSelector } from './MappingSelector';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { Pillar } from '../shared/Pillar';
import { SectionFilterBar } from '../shared/SectionFilterBar';
import { useControllableState } from '../../hooks/useControllableState';

const sectionTabs = [
  { id: 'all', label: 'All' },
  { id: 'config', label: 'Blueprint' },
  { id: 'rules', label: 'Rules' },
  { id: 'adapter', label: 'Adapter' },
  { id: 'preview', label: 'Preview' },
] as const;

export type MappingTabId = typeof sectionTabs[number]['id'];

interface MappingTabProps {
  activeTab?: MappingTabId;
  onActiveTabChange?: (tab: MappingTabId) => void;
  configOpen?: boolean;
  onConfigOpenChange?: (open: boolean) => void;
}

export function MappingTab({
  activeTab: controlledTab,
  onActiveTabChange,
  configOpen,
  onConfigOpenChange,
}: MappingTabProps = {}) {
  const [activeTab, setActiveTab] = useControllableState(controlledTab, onActiveTabChange, 'all' as MappingTabId);

  const showBlueprint = activeTab === 'all' || activeTab === 'config';
  const showRules = activeTab === 'all' || activeTab === 'rules';
  const showAdapter = activeTab === 'all' || activeTab === 'adapter';
  const showPreview = activeTab === 'all' || activeTab === 'preview';

  return (
    <WorkspacePage 
      maxWidth={(activeTab === 'all' || activeTab === 'preview') ? "max-w-[1000px]" : "max-w-[660px]"}
      className="overflow-y-auto min-h-[800px]"
    >
      <WorkspacePageSection padding="px-7" className="sticky top-0 bg-bg-default/80 backdrop-blur-md z-20 pt-4 pb-2 border-b border-border/40">
        {/* Mapping document selector strip */}
        <div className="flex items-center mb-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted mr-2 shrink-0">Mapping</span>
          <MappingSelector />
        </div>
        {/* Section filter tabs */}
        <SectionFilterBar
          tabs={sectionTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ariaLabel="Mapping section filter"
          testIdPrefix="mapping-filter-tab"
        />
      </WorkspacePageSection>

      <WorkspacePageSection padding="px-7" className="flex-1 py-10 min-h-0">
        <Pillar
          data-testid="mapping-pillar-config"
          title="Mapping Blueprint"
          subtitle="Target schema and base configuration"
          helpText="Define the output structure and how it transforms data from the form."
          accentColor="bg-accent"
          hidden={!showBlueprint}
        >
          <MappingConfig open={configOpen} onOpenChange={onConfigOpenChange} />
        </Pillar>

        <Pillar
          data-testid="mapping-pillar-rules"
          title="Transformation Rules"
          subtitle="Individual field and path mappings"
          helpText="Specific logic for how form paths map to target schema paths."
          accentColor="bg-logic"
          hidden={!showRules}
        >
          <RuleEditor />
        </Pillar>

        <Pillar
          data-testid="mapping-pillar-adapter"
          title="Adapter Settings"
          subtitle="Format specific output options"
          helpText="Configure how the mapped data is serialized (XML, CSV, JSON)."
          accentColor="bg-green"
          hidden={!showAdapter}
        >
          <AdapterConfig />
        </Pillar>

        <Pillar
          data-testid="mapping-pillar-preview"
          title="Output Preview"
          subtitle="Real-time transformation result"
          helpText="See how the current form data would be transformed using the defined mapping."
          accentColor="bg-amber"
          hidden={!showPreview}
        >
          <MappingPreview />
        </Pillar>
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
