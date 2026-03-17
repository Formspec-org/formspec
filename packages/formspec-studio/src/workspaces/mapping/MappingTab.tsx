/** @filedesc Mapping workspace tab composing Config, Rules, Adapter, and Preview sub-panels. */
import { useState } from 'react';
import { MappingConfig } from './MappingConfig';
import { RuleEditor } from './RuleEditor';
import { AdapterConfig } from './AdapterConfig';
import { MappingPreview } from './MappingPreview';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';

const tabs = [
  { id: 'config', label: 'Config' },
  { id: 'rules', label: 'Rules' },
  { id: 'adapter', label: 'Adapter' },
  { id: 'preview', label: 'Preview' },
] as const;

export type MappingTabId = (typeof tabs)[number]['id'];

interface MappingTabProps {
  activeTab?: MappingTabId;
  onActiveTabChange?: (tab: MappingTabId) => void;
  configOpen?: boolean;
  onConfigOpenChange?: (open: boolean) => void;
}

export function MappingTab({
  activeTab,
  onActiveTabChange,
  configOpen,
  onConfigOpenChange,
}: MappingTabProps = {}) {
  const [internalActive, setInternalActive] = useState<MappingTabId>('config');
  const [internalConfigOpen, setInternalConfigOpen] = useState(true);
  const active = activeTab ?? internalActive;
  const setActive = onActiveTabChange ?? setInternalActive;
  const isConfigOpen = configOpen ?? internalConfigOpen;
  const setConfigOpen = onConfigOpenChange ?? setInternalConfigOpen;

  let content: React.ReactNode;
  switch (active) {
    case 'config':
      content = <MappingConfig open={isConfigOpen} onOpenChange={setConfigOpen} />;
      break;
    case 'rules':
      content = <RuleEditor />;
      break;
    case 'adapter':
      content = <AdapterConfig />;
      break;
    case 'preview':
      content = <MappingPreview />;
      break;
  }

  return (
    <WorkspacePage>
      <WorkspacePageSection padding="px-0" className="flex border-b border-border sticky top-0 bg-bg-default z-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`px-3 py-2 text-sm cursor-pointer ${
              active === tab.id
                ? 'border-b-2 border-accent text-ink font-medium'
                : 'text-muted hover:text-ink'
            }`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </WorkspacePageSection>
      <WorkspacePageSection className="flex-1 overflow-auto py-4">
        {content}
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
