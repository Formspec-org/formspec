/** @filedesc Colored-border card displaying a single bind rule's type, humanized description, and FEL expression. */
import { useState } from 'react';
import { IconClose, IconExclamation } from '../icons';
import { HighlightedExpression } from './InlineExpression';

const bindColors: Record<string, string> = {
  required: 'text-accent border-l-accent',
  relevant: 'text-logic border-l-logic',
  calculate: 'text-green border-l-green',
  constraint: 'text-amber border-l-amber',
  readonly: 'text-muted border-l-muted',
};

/** Verb-intent display labels for bind types. */
const verbLabels: Record<string, string> = {
  required: 'MUST FILL',
  relevant: 'SHOWS IF',
  calculate: 'FORMULA',
  constraint: 'VALIDATES',
  readonly: 'LOCKED',
};

interface AdvancedProperty {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

interface BindCardProps {
  bindType: string;
  expression: string;
  humanized?: string;
  message?: string;
  children?: React.ReactNode;
  onRemove?: () => void;
  advancedProperties?: AdvancedProperty[];
  error?: { message: React.ReactNode };
  tip?: string;
}

/**
 * Bind type card with colored left border.
 * Shows humanized description and raw FEL expression.
 * When children are provided, they replace the default expression display.
 */
export function BindCard({ bindType, expression, humanized, message, children, onRemove, advancedProperties, error, tip }: BindCardProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const styles = bindColors[bindType] || 'text-muted border-l-muted';
  const colorClass = styles.split(' ')[0];
  const borderClass = styles.split(' ')[1];
  const displayLabel = verbLabels[bindType] || bindType.toUpperCase();

  return (
    <div className={`border border-border border-l-[3px] ${borderClass} rounded-[4px] bg-surface p-2 mb-1 group/card transition-colors hover:border-border/80`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`font-mono text-[9px] font-bold tracking-wider uppercase ${colorClass}`} title={bindType}>
          {displayLabel}
        </span>
        <div className="flex items-center gap-1">
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-error/10 hover:text-error text-muted transition-colors"
              title={`Remove ${bindType}`}
            >
              <IconClose size={10} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      {/* Show humanized description only when there's no inline editor (children). */}
      {humanized && !children && (
        <div className="font-ui text-[12px] text-ink leading-snug mb-1">
          {humanized}
        </div>
      )}

      {children ?? (expression && expression !== 'true' && (
        <div
          className={`font-mono text-[11px] border border-border/60 px-1.5 py-0.5 rounded-[2px] truncate ${error ? 'bg-error/10' : 'bg-subtle'}`}
          title={expression}
          data-testid="bind-expression"
        >
          <HighlightedExpression expression={expression} />
        </div>
      ))}

      {error && (
        <div role="alert" className="flex items-start gap-1 mt-1 text-error text-[11px] leading-tight">
          <IconExclamation className="shrink-0 mt-0.5" />
          <span>{error.message}</span>
        </div>
      )}

      {tip && (
        <div data-testid="bind-tip" className="font-ui text-[10px] text-muted italic mt-1 leading-tight">
          {tip}
        </div>
      )}

      {message && (
        <div className="font-ui text-[11px] text-muted italic mt-1 leading-tight">
          &ldquo;{message}&rdquo;
        </div>
      )}

      {advancedProperties && advancedProperties.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="font-ui text-[10px] text-muted hover:text-ink mt-1 cursor-pointer transition-colors"
          >
            {showAdvanced ? 'Less' : 'More'}
          </button>
          {showAdvanced && (
            <div className="mt-1 space-y-1">
              {advancedProperties.map((prop) => (
                <div key={prop.label} className="flex items-center gap-2">
                  <label htmlFor={`adv-${prop.label}`} className="font-ui text-[10px] text-muted whitespace-nowrap">
                    {prop.label}
                  </label>
                  <input
                    id={`adv-${prop.label}`}
                    type="text"
                    value={prop.value}
                    onChange={(e) => prop.onChange(e.target.value)}
                    className="flex-1 font-mono text-[10px] bg-subtle border border-border rounded px-1 py-0.5 text-ink"
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
