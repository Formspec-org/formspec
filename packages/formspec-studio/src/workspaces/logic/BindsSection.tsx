import { BindCard } from '../../components/ui/BindCard';

interface BindEntry {
  required?: string;
  relevant?: string;
  calculate?: string;
  constraint?: string;
  readonly?: string;
}

interface BindsSectionProps {
  binds: Record<string, BindEntry>;
  activeFilter?: (typeof bindTypes)[number] | null;
  onSelectPath?: (path: string) => void;
}

const bindTypes = ['required', 'relevant', 'calculate', 'constraint', 'readonly'] as const;

export function BindsSection({ binds, activeFilter = null, onSelectPath }: BindsSectionProps) {
  const entries = Object.entries(binds).filter(([, bind]) => {
    if (!activeFilter) return true;
    return Boolean(bind[activeFilter]);
  });
  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      {entries.map(([path, bind]) => (
        <div key={path} className="space-y-1">
          <button
            type="button"
            onClick={() => onSelectPath?.(path)}
            className="text-sm font-medium text-ink hover:text-accent"
          >
            {path}
          </button>
          <div className="space-y-1 pl-2">
            {bindTypes.map((type) => {
              const expression = bind[type];
              if (!expression) return null;
              return <BindCard key={type} bindType={type} expression={expression} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
