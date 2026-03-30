/** @filedesc Dropdown menu for adding a bind behavior type (relevant, required, calculate, etc.) to an item. */
import { useState, useRef, useEffect } from 'react';

const BIND_TYPES = [
  { id: 'relevant', label: 'Relevant', description: 'Control visibility' },
  { id: 'required', label: 'Required', description: 'Force a value' },
  { id: 'readonly', label: 'Readonly', description: 'Disable editing' },
  { id: 'calculate', label: 'Calculate', description: 'Compute value' },
  { id: 'constraint', label: 'Constraint', description: 'Custom validation' },
  { id: 'pre-populate', label: 'Pre-populate', description: 'Source from external' },
] as const;

interface AddBehaviorMenuProps {
  existingTypes: string[];
  onAdd: (type: string) => void;
  className?: string;
  label?: string;
  allowedTypes?: readonly string[];
  /** When set, used for the trigger button styles instead of the default muted text link. */
  triggerClassName?: string;
  /** Accessible name for the trigger (e.g. "Add behavior to {field}"). Overrides visible label for assistive tech. */
  triggerAriaLabel?: string;
}

export function AddBehaviorMenu({
  existingTypes,
  onAdd,
  className,
  label = 'Add behavior rule',
  allowedTypes,
  triggerClassName,
  triggerAriaLabel,
}: AddBehaviorMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const available = BIND_TYPES.filter(t => 
    !existingTypes.includes(t.id) && 
    (!allowedTypes || (allowedTypes as string[]).includes(t.id))
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (available.length === 0) return null;

  const defaultTriggerClass =
    'text-[11px] text-muted hover:text-accent font-mono cursor-pointer transition-colors flex items-center gap-1 py-1';

  return (
    <div className={`relative ${className ?? ''}`} ref={menuRef}>
      <button
        type="button"
        aria-label={triggerAriaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className={triggerClassName ?? defaultTriggerClass}
      >
        <span className="text-[14px] leading-none">+</span> {label}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-48 bg-surface border border-border rounded-[6px] shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-bottom-left">
          <div className="py-1">
            {available.map(type => (
              <button
                key={type.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-subtle group transition-colors"
                onClick={() => {
                  onAdd(type.id);
                  setOpen(false);
                }}
              >
                <div className="text-[11px] font-bold text-ink group-hover:text-accent uppercase tracking-wider mb-0.5">
                  {type.label}
                </div>
                <div className="text-[10px] text-muted leading-tight">
                  {type.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
