import { Pill } from '../../components/ui/Pill';

interface RuleCardProps {
  source: string;
  target: string;
  transform?: string;
}

export function RuleCard({ source, target, transform }: RuleCardProps) {
  const samePath = source === target;

  return (
    <div className="border border-border rounded bg-surface p-2 flex items-center gap-2">
      <span className="font-mono text-sm text-ink">{source}</span>
      {samePath ? (
        <span className="text-muted text-xs italic">(identity)</span>
      ) : (
        <>
          <span className="text-muted text-xs">{'\u2192'}</span>
          <span className="font-mono text-sm text-ink">{target}</span>
        </>
      )}
      {transform && (
        <Pill text={transform} color="accent" size="sm" />
      )}
    </div>
  );
}
