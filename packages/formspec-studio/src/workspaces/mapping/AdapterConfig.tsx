import { useMapping } from '../../state/useMapping';
import { Section } from '../../components/ui/Section';
import { Pill } from '../../components/ui/Pill';

export function AdapterConfig() {
  const mapping = useMapping();
  const adapter = (mapping as any)?.adapter as
    | { format?: string; options?: Record<string, unknown> }
    | undefined;
  const adapters = (mapping as any)?.adapters as Record<string, unknown> | undefined;

  // Support both singular `adapter` and plural `adapters` shapes
  const hasAdapter = adapter?.format || (adapters && Object.keys(adapters).length > 0);

  if (!hasAdapter) {
    return (
      <Section title="Adapter">
        <div className="text-sm text-muted">No adapter configured</div>
      </Section>
    );
  }

  return (
    <Section title="Adapter">
      <div className="flex flex-col gap-2 text-sm">
        {adapter?.format && (
          <div className="flex items-center justify-between">
            <span className="text-muted">Format</span>
            <Pill text={adapter.format} color="accent" />
          </div>
        )}
        {adapter?.options && Object.entries(adapter.options).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-muted">{key}</span>
            <span className="text-xs text-ink">{String(value)}</span>
          </div>
        ))}
        {adapters && Object.entries(adapters).map(([format, config]) => (
          <div key={format} className="flex items-center justify-between">
            <span className="text-muted">{format}</span>
            <Pill text={format} color="accent" size="sm" />
          </div>
        ))}
      </div>
    </Section>
  );
}
