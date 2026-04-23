/** @filedesc Severity-colored card displaying a validation shape rule with name, constraint, and message. */
import { HighlightedExpression } from './InlineExpression';
import { Pill } from './Pill';

const severityColors: Record<string, string> = {
  error: 'border-l-error',
  warning: 'border-l-amber',
  info: 'border-l-accent',
};

interface ShapeCardProps {
  name: string;
  severity?: string;
  constraint: string;
  message?: string;
  code?: string;
}

/**
 * Severity-colored validation shape card.
 */
export function ShapeCard({ name, severity, constraint, message, code }: ShapeCardProps) {
  const borderClass = severityColors[severity || 'info'] || 'border-l-muted';
  const pillColor = severity === 'error' ? 'error' : severity === 'warning' ? 'amber' : 'accent';

  return (
    <div className={`border border-border border-l-[3px] ${borderClass} rounded-[4px] bg-surface p-2.5 mb-1.5`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Pill text={severity || 'info'} color={pillColor} size="sm" />
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] text-muted tracking-wide uppercase">
            {name}
          </span>
          {code && (
            <span className="font-mono text-[9px] text-muted/80 tracking-wide uppercase">
              {code}
            </span>
          )}
        </div>
      </div>
      
      {message && (
        <div className="font-ui text-[12px] text-ink leading-snug mb-1.5">
          {message}
        </div>
      )}
      
      {constraint && (
        <div data-testid="shape-constraint" className="font-mono text-[11px] bg-subtle border border-border/60 px-1.5 py-1 rounded-[2px] break-all">
          <HighlightedExpression expression={constraint} />
        </div>
      )}
    </div>
  );
}
