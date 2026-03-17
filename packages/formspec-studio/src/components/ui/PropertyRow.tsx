/** @filedesc Two-column label/value row for property panels with optional help tooltip and color. */
import { HelpTip } from './HelpTip';

interface PropertyRowProps {
  label: string;
  children: React.ReactNode;
  color?: string;
  help?: string;
}

/**
 * Label/value row for property panels.
 * Highly compact, justified baseline alignment.
 * Optional help tooltip on the label.
 */
export function PropertyRow({ label, children, color, help }: PropertyRowProps) {
  const labelContent = (
    <span className="font-mono text-[11px] text-muted shrink-0 uppercase tracking-tight">
      {label}
    </span>
  );

  return (
    <div className="flex justify-between items-baseline gap-4 py-0.5 border-b border-border/50 last:border-0 transition-colors hover:bg-subtle/30">
      {help ? (
        <HelpTip text={help}>{labelContent}</HelpTip>
      ) : (
        labelContent
      )}
      <span className={`font-mono text-[11.5px] text-right truncate flex-1 ${color || 'text-ink'}`}>
        {children}
      </span>
    </div>
  );
}
