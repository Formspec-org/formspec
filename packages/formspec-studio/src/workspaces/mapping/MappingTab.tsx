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

type TabId = (typeof tabs)[number]['id'];

export function MappingTab() {
  const [activeTab, setActiveTab] = useState<TabId>('config');
  const [configOpen, setConfigOpen] = useState(true);

  let content: React.ReactNode;
  switch (activeTab) {
    case 'config':
      content = <MappingConfig open={configOpen} onOpenChange={setConfigOpen} />;
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
              activeTab === tab.id
                ? 'border-b-2 border-accent text-ink font-medium'
                : 'text-muted hover:text-ink'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">{content}</div>
    </div>
  );
}
