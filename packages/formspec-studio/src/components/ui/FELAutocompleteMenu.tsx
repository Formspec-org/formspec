import React from 'react';
import { FloatingPortal, type UseFloatingReturn } from '@floating-ui/react';
import { dataTypeInfo } from '@formspec-org/studio-core';
import type { AutocompleteOption } from '../../hooks/useFELAutocomplete';

interface FELAutocompleteMenuProps {
  options: AutocompleteOption[];
  activeIndex: number;
  onSelect: (option: AutocompleteOption) => void;
  onHover: (index: number) => void;
  refs: UseFloatingReturn['refs'];
  floatingStyles: React.CSSProperties;
  isPositioned: boolean;
}

export function FELAutocompleteMenu({
  options,
  activeIndex,
  onSelect,
  onHover,
  refs,
  floatingStyles,
  isPositioned,
}: FELAutocompleteMenuProps) {
  if (options.length === 0) return null;
  const activeOption = options[activeIndex];

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={{ ...floatingStyles, opacity: isPositioned ? 1 : 0, transition: 'opacity 100ms ease-out' }}
        className="z-[100] flex bg-surface border border-border rounded-lg shadow-2xl overflow-hidden"
      >
        {/* Menu List */}
        <div className="w-64 border-r border-border/50">
          <ul className="max-h-64 overflow-y-auto py-1">
            {options.map((opt, i) => {
              const isSelected = activeIndex === i;
              let icon = 'ƒ';
              let iconColor = 'text-logic';
              
              if (opt.kind === 'path') {
                const type = dataTypeInfo(opt.dataType || 'string');
                icon = type.icon;
                iconColor = type.color;
              } else if (opt.kind === 'instanceName') {
                icon = '@';
                iconColor = 'text-accent';
              }

              return (
                <li 
                  key={i}
                  className={`px-3 py-1.5 text-[11px] font-mono cursor-pointer flex items-center gap-2.5
                    ${isSelected ? 'bg-accent text-white' : 'hover:bg-subtle text-ink'}
                  `}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(opt);
                  }}
                  onMouseEnter={() => onHover(i)}
                >
                  <span className={`w-4 text-center ${isSelected ? 'text-white' : iconColor} opacity-80 shrink-0 font-bold`}>
                    {icon}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="font-bold truncate">
                      {opt.kind === 'path' ? `$${opt.path}` : opt.name}
                    </span>
                    {opt.kind === 'path' && opt.label !== opt.path && (
                      <span className={`text-[10px] truncate ${isSelected ? 'text-white/70' : 'text-muted/80'}`}>
                        {opt.label}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Peek Pane - Function Details */}
        {activeOption?.kind === 'function' && (
          <div className="w-48 bg-subtle/20 p-3 flex flex-col gap-2 animate-in slide-in-from-left-2 duration-200">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted font-bold">Signature</span>
              <span className="text-[11px] font-mono text-logic font-semibold">
                {activeOption.signature?.split('->')[0]?.trim()}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted font-bold">Returns</span>
              <span className="text-[11px] font-mono text-ink/70">
                {activeOption.signature?.split('->')[1]?.trim() || 'any'}
              </span>
            </div>
            {activeOption.description && (
              <div className="text-[10px] text-ink/60 leading-normal mt-1 border-t border-border/40 pt-2">
                {activeOption.description}
              </div>
            )}
          </div>
        )}
      </div>
    </FloatingPortal>
  );
}
