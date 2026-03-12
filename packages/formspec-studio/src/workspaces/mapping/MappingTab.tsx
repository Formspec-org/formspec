import { useState } from 'react';
import { MappingConfig } from './MappingConfig';
import { RuleEditor } from './RuleEditor';
import { AdapterConfig } from './AdapterConfig';
import { MappingPreview } from './MappingPreview';

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
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`px-3 py-2 text-sm ${
              active === tab.id
                ? 'border-b-2 border-accent text-ink font-medium'
                : 'text-muted hover:text-ink'
            }`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">{content}</div>
    </div>
  );
}
