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
  onEditBind?: (path: string, type: string, expression: string) => void;
}

const bindTypes = ['required', 'relevant', 'calculate', 'constraint', 'readonly'] as const;

export function BindsSection({ binds, activeFilter = null, onSelectPath, onEditBind }: BindsSectionProps) {
  const entries = Object.entries(binds).filter(([, bind]) => {
    if (!activeFilter) return true;
    return Boolean(bind[activeFilter]);
  });
  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      {entries.map(([path, bind]) => (
        <div key={path} className="space-y-1.5">
          <button
            type="button"
            onClick={() => onSelectPath?.(path)}
            className="text-[14px] font-bold text-ink hover:text-accent font-mono transition-colors"
          >
            {path}
          </button>
          <div className="space-y-1.5 pl-3 border-l border-border/50 ml-1">
            {bindTypes.map((type) => {
              const expression = bind[type];
              if (!expression) return null;
              return (
                <button
                  key={type}
                  type="button"
                  className="w-full text-left bg-transparent border-none p-0 focus:outline-none focus:ring-1 focus:ring-accent rounded transition-all hover:scale-[1.01] active:scale-[0.99]"
                  onClick={() => onEditBind?.(path, type, expression)}
                >
                  <BindCard bindType={type} expression={expression} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
