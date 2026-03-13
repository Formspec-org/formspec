import { Pill } from '../../components/ui/Pill';

interface BindEntry {
  required?: string;
  relevant?: string;
  calculate?: string;
  constraint?: string;
  readonly?: string;
}

interface FilterBarProps {
  binds: Record<string, BindEntry>;
  activeFilter?: (typeof bindTypes)[number] | null;
  onFilterSelect?: (filter: (typeof bindTypes)[number] | null) => void;
}

const bindTypes = ['required', 'relevant', 'calculate', 'constraint', 'readonly'] as const;

const pillColors: Record<string, 'accent' | 'logic' | 'green' | 'error' | 'amber'> = {
  required: 'accent',
  relevant: 'logic',
  calculate: 'green',
  constraint: 'error',
  readonly: 'amber',
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
