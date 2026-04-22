/** @filedesc Reusable expandable card with clickable header, chevron indicator, and collapsible content area. */
import type React from 'react';

interface ExpandableCardProps {
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  header: React.ReactNode;
  className?: string;
  expandedClassName?: string;
  collapsedClassName?: string;
  'data-testid'?: string;
}

export function ExpandableCard({
  children,
  expanded,
  onToggle,
  header,
  className,
  expandedClassName = 'border-accent shadow-md ring-1 ring-accent/10 bg-surface',
  collapsedClassName = 'border-border bg-surface/50 hover:border-muted hover:bg-surface',
  'data-testid': testId,
}: ExpandableCardProps) {
  return (
    <div
      data-testid={testId}
      className={`rounded-xl border transition-all ${expanded ? expandedClassName : collapsedClassName} ${className ?? ''}`}
    >
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={onToggle}
      >
        {header}
        <div className={`text-[12px] text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>&#9660;</div>
      </div>
      {expanded && (
        <div className="p-6 pt-0 border-t border-border animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
