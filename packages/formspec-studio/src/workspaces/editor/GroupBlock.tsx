import type { ReactNode } from 'react';
import { Pill } from '../../components/ui/Pill';

interface GroupBlockProps {
  itemKey: string;
  itemPath: string;
  registerTarget: (path: string, element: HTMLElement | null) => void;
  label?: string;
  repeatable?: boolean;
  minRepeat?: number;
  maxRepeat?: number;
  depth: number;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}

export function GroupBlock({
  itemKey,
  itemPath,
  registerTarget,
  label,
  repeatable,
  minRepeat,
  maxRepeat,
  depth,
  selected,
  onSelect,
  children,
}: GroupBlockProps) {
  return (
    <div
      style={{ marginLeft: depth > 0 ? depth * 20 : 0 }}
      className={`mb-1 ${depth === 0 ? 'mt-6' : 'mt-3'}`}
    >
      <div
        ref={(element) => registerTarget(itemPath, element)}
        data-testid={`group-${itemKey}`}
        data-item-path={itemPath}
        data-item-type="group"
        onClick={onSelect}
        className={`flex items-center gap-2 px-0 py-2 border-b-2 cursor-pointer transition-colors group ${
          selected ? 'border-accent' : 'border-ink/80'
        }`}
      >
        {/* Accent Bar */}
        <div
          className={`w-[3px] h-[14px] rounded-[1px] transition-colors shrink-0 ${
            selected ? 'bg-accent' : 'bg-ink/70'
          }`}
        />

        {/* Label */}
        <span className={`font-mono text-[12px] font-bold tracking-[0.14em] uppercase transition-colors ${
          selected ? 'text-accent' : 'text-ink'
        }`}>
          {label || itemKey}
        </span>

        {/* Repeat Indicator */}
        {repeatable && (
          <Pill
            text={`⟳ ${minRepeat ?? 0}–${maxRepeat ?? '∞'}`}
            color="logic"
            size="sm"
          />
        )}

        <div className="flex-1" />
        
        <span className="font-mono text-[9.5px] text-muted opacity-0 group-hover:opacity-60 transition-opacity">
          {itemKey}
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        {children}
      </div>
    </div>
  );
}
