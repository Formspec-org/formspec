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
}

const bindTypes = ['required', 'relevant', 'calculate', 'constraint', 'readonly'] as const;

const pillColors: Record<string, 'accent' | 'logic' | 'green' | 'error' | 'amber'> = {
  required: 'accent',
  relevant: 'logic',
  calculate: 'green',
  constraint: 'error',
  readonly: 'amber',
};

export function FilterBar({ binds }: FilterBarProps) {
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
    <div className="flex gap-2 px-3 py-2 border-b border-border">
      {bindTypes.map((type) => (
        <Pill key={type} text={`${type} (${counts[type]})`} color={pillColors[type]} size="sm" />
      ))}
    </div>
  );
}
