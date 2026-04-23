/** @filedesc Card editor for a pre-populate bind rule specifying the external instance and field path. */
import { HelpTip } from './HelpTip';
import { propertyHelp } from '@formspec-org/studio-core';

interface PrePopulateCardProps {
  value: { instance: string; path: string; editable?: boolean };
  onChange: (value: PrePopulateCardProps['value']) => void;
  onRemove: () => void;
  /** DI-5: Unique prefix for DOM IDs (prevents collisions when multiple cards exist). */
  itemKey?: string;
}

export function PrePopulateCard({ value, onChange, onRemove, itemKey = '' }: PrePopulateCardProps) {
  // DI-5: Use item-specific IDs to avoid duplicate DOM IDs.
  const idPrefix = itemKey ? `pre-pop-${itemKey}` : 'pre-pop';
  return (
    <div className="border border-border border-l-[3px] border-l-blue-500 rounded-[4px] bg-surface p-2 mb-1 group/card transition-colors hover:border-border/80">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[9px] font-bold tracking-wider uppercase text-blue-500">
          Pre-populate
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-error/10 hover:text-error text-muted/40 transition-colors"
          title="Remove pre-populate"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-instance`} className="font-mono text-[8px] text-muted uppercase tracking-wider block">
            Instance
          </label>
          <input
            id={`${idPrefix}-instance`}
            type="text"
            className="w-full px-1.5 py-0.5 text-[11px] font-mono border border-border rounded-[3px] bg-subtle outline-none focus:border-accent transition-colors"
            value={value.instance || ''}
            onChange={(e) => onChange({ ...value, instance: e.target.value })}
            placeholder="instance_id"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-path`} className="font-mono text-[8px] text-muted uppercase tracking-wider block">
            Path
          </label>
          <input
            id={`${idPrefix}-path`}
            type="text"
            className="w-full px-1.5 py-0.5 text-[11px] font-mono border border-border rounded-[3px] bg-subtle outline-none focus:border-accent transition-colors"
            value={value.path || ''}
            onChange={(e) => onChange({ ...value, path: e.target.value })}
            placeholder="data.path"
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <input
          id={`${idPrefix}-editable`}
          type="checkbox"
          checked={value.editable !== false}
          onChange={(e) => onChange({ ...value, editable: e.target.checked })}
          className="w-3 h-3 accent-accent"
        />
        <label htmlFor={`${idPrefix}-editable`} className="text-[10px] text-muted font-mono uppercase tracking-tight cursor-pointer">
          Editable by user
        </label>
      </div>
    </div>
  );
}
