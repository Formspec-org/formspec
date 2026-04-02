/** @filedesc Small themed badge pill for displaying labels, counts, and status values. */
const colorMap: Record<string, string> = {
  accent: 'bg-accent/10 text-accent border-accent/20',
  logic: 'bg-logic/10 text-logic border-logic/20',
  error: 'bg-error/10 text-error border-error/20',
  green: 'bg-green/10 text-green border-green/20',
  amber: 'bg-amber/10 text-amber border-amber/20',
  muted: 'bg-subtle text-muted border-border',
};

interface PillProps {
  text: string;
  color?: keyof typeof colorMap;
  size?: 'sm' | 'md';
  /** Spec-normative term rendered as HTML title for tooltip discoverability. */
  title?: string;
  /** When true, appends a warning indicator and applies a warning border. */
  warn?: boolean;
}

export function Pill({ text, color = 'muted', size = 'md', title, warn }: PillProps) {
  const colorClasses = colorMap[color] || colorMap.muted;
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-sm px-2 py-0.5';
  const warnClasses = warn ? ' border-amber/40' : '';
  return (
    <span className={`inline-flex items-center rounded-sm border font-ui ${colorClasses} ${sizeClasses}${warnClasses}`} title={title}>
      {text}{warn ? ' \u26A0' : ''}
    </span>
  );
}
