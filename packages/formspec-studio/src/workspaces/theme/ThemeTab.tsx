import { useState } from 'react';
import { TokenEditor } from './TokenEditor';
import { DefaultsEditor } from './DefaultsEditor';
import { SelectorList } from './SelectorList';
import { ItemOverrides } from './ItemOverrides';
import { PageLayouts } from './PageLayouts';
import { BreakpointEditor } from './BreakpointEditor';

const tabs = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'defaults', label: 'Defaults' },
  { id: 'selectors', label: 'Selectors' },
  { id: 'items', label: 'Item Overrides' },
  { id: 'pages', label: 'Page Layouts' },
  { id: 'breakpoints', label: 'Breakpoints' },
] as const;

type TabId = (typeof tabs)[number]['id'];

const tabContent: Record<TabId, () => React.ReactNode> = {
  tokens: () => <TokenEditor />,
  defaults: () => <DefaultsEditor />,
  selectors: () => <SelectorList />,
  items: () => <ItemOverrides />,
  pages: () => <PageLayouts />,
  breakpoints: () => <BreakpointEditor />,
};

export function ThemeTab() {
  const [activeTab, setActiveTab] = useState<TabId>('tokens');

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
      <div className="flex-1 overflow-auto">
        {tabContent[activeTab]()}
      </div>
    </div>
  );
}
