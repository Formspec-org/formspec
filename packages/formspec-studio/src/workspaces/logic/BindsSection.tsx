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
}

const bindTypes = ['required', 'relevant', 'calculate', 'constraint', 'readonly'] as const;

export function BindsSection({ binds }: BindsSectionProps) {
  const entries = Object.entries(binds);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      {entries.map(([path, bind]) => (
        <div key={path} className="space-y-1">
          <div className="text-sm font-medium text-ink">{path}</div>
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
