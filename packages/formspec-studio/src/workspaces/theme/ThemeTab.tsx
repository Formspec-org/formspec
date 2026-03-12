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

export type ThemeTabId = (typeof tabs)[number]['id'];

interface ThemeTabProps {
  activeTab?: ThemeTabId;
  onActiveTabChange?: (tab: ThemeTabId) => void;
}

const tabContent: Record<ThemeTabId, () => React.ReactNode> = {
  tokens: () => <TokenEditor />,
  defaults: () => <DefaultsEditor />,
  selectors: () => <SelectorList />,
  items: () => <ItemOverrides />,
  pages: () => <PageLayouts />,
  breakpoints: () => <BreakpointEditor />,
};

export function ThemeTab({ activeTab, onActiveTabChange }: ThemeTabProps = {}) {
  const [internalActive, setInternalActive] = useState<ThemeTabId>('tokens');
  const active = activeTab ?? internalActive;
  const setActive = onActiveTabChange ?? setInternalActive;

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`theme-tab-${tab.id}`}
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
      <div className="flex-1 overflow-auto">
        {tabContent[active]()}
      </div>
    </div>
  );
}
