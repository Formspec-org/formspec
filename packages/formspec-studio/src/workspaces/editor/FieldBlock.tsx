import { Pill } from '../../components/ui/Pill';
import { FieldIcon } from '../../components/ui/FieldIcon';

interface FieldBlockProps {
  itemKey: string;
  label?: string;
  dataType?: string;
  binds: Record<string, string>;
  depth: number;
  selected: boolean;
  onSelect: () => void;
}

export function FieldBlock({ itemKey, label, dataType, binds, depth, selected, onSelect }: FieldBlockProps) {
  const indent = depth * 24;
  return (
    <div
      data-testid={`field-${itemKey}`}
      className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
        selected ? 'border-accent bg-accent/5' : 'border-border bg-surface hover:bg-subtle'
      }`}
      style={{ marginLeft: indent }}
      onClick={onSelect}
    >
      {dataType && <FieldIcon dataType={dataType} />}
      <span className="text-sm font-medium text-foreground">{label || itemKey}</span>
      <span className="text-xs text-muted">{itemKey}</span>
      <span className="flex-1" />
      {binds.required && <Pill text="Required" color="accent" size="sm" />}
      {binds.calculate && <Pill text="Calc" color="logic" size="sm" />}
      {binds.constraint && <Pill text="Constraint" color="amber" size="sm" />}
      {binds.readonly && <Pill text="Readonly" color="muted" size="sm" />}
      {binds.relevant && <Pill text="Relevant" color="green" size="sm" />}
    </div>
  );
}
