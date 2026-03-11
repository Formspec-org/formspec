import { useState } from 'react';
import { ResponseSchema } from './ResponseSchema';
import { DataSources } from './DataSources';
import { OptionSets } from './OptionSets';
import { TestResponse } from './TestResponse';

const tabs = ['Response Schema', 'Data Sources', 'Option Sets', 'Test Response'] as const;
type Tab = typeof tabs[number];

const tabComponents: Record<Tab, React.FC> = {
  'Response Schema': ResponseSchema,
  'Data Sources': DataSources,
  'Option Sets': OptionSets,
  'Test Response': TestResponse,
};

export function DataTab() {
  const [active, setActive] = useState<Tab>('Response Schema');
  const ActiveComponent = tabComponents[active];

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-neutral-700">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-3 py-1.5 text-xs ${
              active === tab
                ? 'text-accent border-b-2 border-accent'
                : 'text-muted hover:text-foreground'
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
