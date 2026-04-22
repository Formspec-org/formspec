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
      className="flex items-center gap-1.5 p-1 bg-subtle/50 rounded-[8px] border border-border/50 w-fit"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-selected={activeTab === tab.id}
          data-testid={testIdPrefix ? `${testIdPrefix}-${tab.id}` : undefined}
          onClick={() => onTabChange(tab.id)}
          className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider rounded-[6px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
            activeTab === tab.id
              ? 'bg-accent text-white shadow-sm'
              : 'text-muted hover:text-ink hover:bg-subtle'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
