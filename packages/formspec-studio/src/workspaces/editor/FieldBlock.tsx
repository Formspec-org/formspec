import { Pill } from '../../components/ui/Pill';
import { FieldIcon } from '../../components/ui/FieldIcon';
import { humanizeFEL } from '../../lib/humanize';
import { dataTypeInfo } from '../../lib/field-helpers';
import { blockIndent, blockRef, type BlockBaseProps } from './block-utils';
import { DragHandle } from './DragHandle';

const iconBgMap: Record<string, string> = {
  'text-accent': 'bg-accent/10 border-accent/20',
  'text-green': 'bg-green/10 border-green/20',
  'text-amber': 'bg-amber/10 border-amber/20',
  'text-logic': 'bg-logic/10 border-logic/20',
  'text-muted': 'bg-subtle border-border',
};

interface FieldBlockProps extends BlockBaseProps {
  label?: string;
  hint?: string;
  dataType?: string;
  binds: Record<string, string>;
}

export function FieldBlock({
  itemKey,
  itemPath,
  registerTarget,
  label,
  hint,
  dataType,
  binds,
  depth,
  selected,
  isInSelection,
  onSelect,
}: FieldBlockProps) {
  const dt = dataType ? dataTypeInfo(dataType) : { icon: '?', label: 'unknown', color: 'text-muted' };
  const iconBg = iconBgMap[dt.color] || 'bg-subtle border-border';

  const hasRel = !!binds.relevant;
  const hasCal = !!binds.calculate;
  const hasCon = !!binds.constraint;
  const isReq = !!binds.required;
  const isReadonly = !!binds.readonly;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const fieldCards = Array.from(
      document.querySelectorAll<HTMLElement>('[data-item-type="field"]')
    );
    const currentIndex = fieldCards.indexOf(event.currentTarget);
    if (currentIndex === -1) return;

    const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
    const nextField = fieldCards[nextIndex];
    if (!nextField) return;

    event.preventDefault();
    nextField.focus();
  };

  return (
    <div
      ref={blockRef(itemPath, registerTarget)}
      data-testid={`field-${itemKey}`}
      data-item-path={itemPath}
      data-item-type="field"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`group relative bg-surface border rounded-[4px] cursor-pointer transition-all flex ${
        selected ? 'border-accent ring-1 ring-accent/20 z-10'
        : isInSelection ? 'border-accent bg-accent/5 z-10'
        : 'border-border hover:border-muted/40'
      }`}
      style={{ marginLeft: blockIndent(depth) }}
    >
      {/* Indentation Guide Line */}
      {depth > 0 && (
        <div className="absolute -left-3 top-0 bottom-0 border-l border-dashed border-border">
          <div className="absolute top-1/2 -left-px w-2.5 border-b border-dashed border-border" />
        </div>
      )}

      {/* Drag Handle — full-height left column */}
      <DragHandle className="rounded-l-[3px]" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start px-3 py-2 gap-2.5">
          {/* Icon Badge */}
          <div className={`w-[24px] h-[24px] rounded-[3px] border flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
            <FieldIcon dataType={dataType || 'string'} className={`text-[11px] font-semibold ${dt.color}`} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Label Row */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-ui text-[15px] font-medium tracking-tight text-ink truncate min-w-0">
                {label || itemKey}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {isReq && <Pill text="req" color="accent" size="sm" />}
                {hasCal && <Pill text="ƒx" color="green" size="sm" />}
                {isReadonly && <Pill text="ro" color="muted" size="sm" />}
              </div>
            </div>

            {/* Metadata Row */}
            <div className="flex items-center gap-2 mt-0.5 font-mono text-[10.5px] text-muted overflow-hidden">
              <span className={`${dt.color} shrink-0`}>{dt.label}</span>
              <span className="opacity-55 shrink-0">{itemKey}</span>
              {hint && <span className="opacity-45 italic truncate">— {hint}</span>}
            </div>
          </div>
        </div>

        {/* Summary Strip */}
        {(hasRel || hasCal || hasCon) && (
          <div className="border-t border-border px-3 py-1 ml-[34px] flex gap-3.5 flex-wrap font-mono text-[10.5px]">
            {hasRel && (
              <span className="text-logic flex items-center gap-1">
                <span className="text-[9px]">◈</span> {humanizeFEL(binds.relevant)}
              </span>
            )}
            {hasCal && (
              <span className="text-green flex items-center gap-1">
                <span className="text-[9px]">ƒ</span> Auto-calculated
              </span>
            )}
            {hasCon && (
              <span className="text-amber flex items-center gap-1">
                <span className="text-[9px]">⚡</span> Validated
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
