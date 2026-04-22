/** @filedesc Pill-based filter bar for narrowing the logic tab view to a specific bind type. */
import { Pill } from '../../components/ui/Pill';
import { type BindEntry, bindTypes } from './bind-types';

interface FilterBarProps {
  binds: Record<string, BindEntry>;
  activeFilter?: (typeof bindTypes)[number] | null;
  onFilterSelect?: (filter: (typeof bindTypes)[number] | null) => void;
}

const pillColors: Record<string, 'accent' | 'logic' | 'green' | 'error' | 'amber' | 'indigo'> = {
  required: 'accent',
  relevant: 'logic',
  calculate: 'green',
  constraint: 'error',
  readonly: 'amber',
  'pre-populate': 'indigo',
};

export function FilterBar({ binds, activeFilter = null, onFilterSelect }: FilterBarProps) {
  const counts: Record<string, number> = {};
  for (const type of bindTypes) {
    counts[type] = 0;
  }

  for (const bind of Object.values(binds)) {
    for (const type of bindTypes) {
      if (bind[type]) counts[type]++;
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 py-1">
      {bindTypes.map((type) => {
        const isActive = activeFilter === type;
        const hasFilter = activeFilter !== null;
        const color = isActive || !hasFilter ? pillColors[type] : 'muted';
        
        return (
          <button
            key={type}
            type="button"
            onClick={() => onFilterSelect?.(isActive ? null : type)}
            className={`transition-all duration-200 ${isActive ? 'scale-105' : 'hover:scale-105'}`}
            title={`Filter by ${type}`}
          >
            <Pill text={`${type} (${counts[type]})`} color={color} size="sm" />
          </button>
        );
      })}
    </div>
  );
}
