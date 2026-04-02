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
    <span className="text-[12px] font-medium text-muted shrink-0">
      {label}
    </span>
  );

  return (
    <div className="flex items-start justify-between gap-4 rounded-[10px] px-2 py-2 transition-colors hover:bg-surface/80">
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
