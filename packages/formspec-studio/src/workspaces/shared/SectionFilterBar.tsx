/** @filedesc Reusable tab-strip filter bar used across workspace tabs. */
import type React from 'react';

interface SectionFilterBarProps<T extends string> {
  tabs: readonly { id: T; label: string }[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  ariaLabel?: string;
  testIdPrefix?: string;
}

export function SectionFilterBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel = 'Section filter',
  testIdPrefix,
}: SectionFilterBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex items-center gap-0.5 p-0.5 bg-subtle rounded-md border border-border w-fit shadow-inner"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          data-testid={testIdPrefix ? `${testIdPrefix}-${tab.id}` : undefined}
          onClick={() => onTabChange(tab.id)}
          className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-normal rounded-sm transition-all duration-200 focus-ring ${
            activeTab === tab.id
              ? 'bg-accent text-surface shadow-sm'
              : 'text-muted hover:text-ink hover:bg-surface'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
