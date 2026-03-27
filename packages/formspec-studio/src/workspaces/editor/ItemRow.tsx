/** @filedesc Compact tree row for field and display items in the definition tree editor. */
import { Pill } from '../../components/ui/Pill';
import { FieldIcon } from '../../components/ui/FieldIcon';
import { dataTypeInfo } from '../../lib/field-helpers';

interface ItemRowProps {
  itemKey: string;
  itemType: 'field' | 'display';
  label?: string;
  dataType?: string;
  widgetHint?: string;
  binds: Record<string, string>;
  depth: number;
}

export function ItemRow({
  itemKey,
  itemType,
  label,
  dataType,
  widgetHint,
  binds,
  depth,
}: ItemRowProps) {
  const isField = itemType === 'field';
  const testId = isField ? `field-${itemKey}` : `display-${itemKey}`;

  const dt = dataType ? dataTypeInfo(dataType) : null;
  const isReq = !!binds.required;
  const hasCal = !!binds.calculate;
  const isReadonly = !!binds.readonly;

  return (
    <div
      data-testid={testId}
      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-subtle transition-colors"
      style={{ paddingLeft: depth * 20 + 8 }}
    >
      {/* Type icon */}
      {isField && dt && (
        <FieldIcon dataType={dataType!} className={`text-[11px] shrink-0 ${dt.color}`} />
      )}
      {!isField && (
        <span className="text-[11px] text-accent/70 font-mono shrink-0">
          {widgetHint === 'heading' ? 'H' : widgetHint === 'divider' ? '\u2014' : '\u2139'}
        </span>
      )}

      {/* Label */}
      <span className="text-sm text-ink truncate min-w-0">
        {label || itemKey}
      </span>

      {/* Badge: dataType for fields, widgetHint for display */}
      {isField && dataType && (
        <span className={`text-[10px] font-mono ${dt?.color ?? 'text-muted'} shrink-0`}>
          {dataType}
        </span>
      )}
      {!isField && widgetHint && (
        <span className="text-[10px] font-mono text-accent/60 shrink-0">
          {widgetHint}
        </span>
      )}

      {/* Bind pills */}
      {isReq && <Pill text="req" color="accent" size="sm" />}
      {hasCal && <Pill text="ƒx" color="green" size="sm" />}
      {isReadonly && <Pill text="ro" color="muted" size="sm" />}
    </div>
  );
}
