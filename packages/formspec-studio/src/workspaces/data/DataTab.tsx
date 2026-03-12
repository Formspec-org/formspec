import { useState } from 'react';
import { ResponseSchema } from './ResponseSchema';
import { DataSources } from './DataSources';
import { OptionSets } from './OptionSets';
import { TestResponse } from './TestResponse';

const tabs = ['Response Schema', 'Data Sources', 'Option Sets', 'Test Response'] as const;
export type Tab = typeof tabs[number];

const tabComponents: Record<Tab, React.FC> = {
  'Response Schema': ResponseSchema,
  'Data Sources': DataSources,
  'Option Sets': OptionSets,
  'Test Response': TestResponse,
};

interface DataTabProps {
  activeTab?: Tab;
  onActiveTabChange?: (tab: Tab) => void;
}

export function DataTab({ activeTab, onActiveTabChange }: DataTabProps = {}) {
  const [internalActive, setInternalActive] = useState<Tab>('Response Schema');
  const active = activeTab ?? internalActive;
  const setActive = onActiveTabChange ?? setInternalActive;
  const ActiveComponent = tabComponents[active];

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border bg-surface">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-3 py-1.5 text-xs ${
              active === tab
                ? 'border-b-2 border-accent text-accent'
                : 'text-foreground/70 hover:text-ink'
            }`}
            onClick={() => setActive(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        <ActiveComponent />
      </div>
    </div>
  );
}
