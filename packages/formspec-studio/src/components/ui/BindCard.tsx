/** @filedesc Colored-border card displaying a single bind rule's type, humanized description, and FEL expression. */
import { FELReferencePopup } from './FELReferencePopup';

const bindColors: Record<string, string> = {
  required: 'text-accent border-l-accent',
  relevant: 'text-logic border-l-logic',
  calculate: 'text-green border-l-green',
  constraint: 'text-amber border-l-amber',
  readonly: 'text-muted border-l-muted',
};

interface BindCardProps {
  bindType: string;
  expression: string;
  humanized?: string;
  message?: string;
  children?: React.ReactNode;
  onRemove?: () => void;
}

/**
 * Bind type card with colored left border.
 * Shows humanized description and raw FEL expression.
 * When children are provided, they replace the default expression display.
 */
export function BindCard({ bindType, expression, humanized, message, children, onRemove }: BindCardProps) {
  const styles = bindColors[bindType] || 'text-muted border-l-muted';
  const colorClass = styles.split(' ')[0];
  const borderClass = styles.split(' ')[1];

  return (
    <div className={`border border-border border-l-[3px] ${borderClass} rounded-[4px] bg-surface p-2 mb-1 group/card transition-colors hover:border-border/80`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`font-mono text-[9px] font-bold tracking-wider uppercase ${colorClass}`}>
          {bindType}
        </span>
        <div className="flex items-center gap-1">
          <FELReferencePopup />
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-error/10 hover:text-error text-muted/40 transition-colors"
              title={`Remove ${bindType}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

      {humanized && (
        <div className="font-ui text-[12px] text-ink leading-snug mb-1">
          {humanized}
        </div>
      )}

      {children ?? (expression && expression !== 'true' && (
        <div
          className="font-mono text-[10px] text-muted bg-subtle px-1.5 py-0.5 rounded-[2px] truncate"
          title={expression}
        >
          {expression}
        </div>
      ))}

      {message && (
        <div className="font-ui text-[11px] text-muted italic mt-1 leading-tight">
          &ldquo;{message}&rdquo;
        </div>
      )}
    </div>
  );
}
