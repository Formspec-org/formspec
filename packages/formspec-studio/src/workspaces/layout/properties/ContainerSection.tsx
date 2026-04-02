/** @filedesc Layout properties section for container component properties (direction, gap, columns, padding). */
import { Section } from '../../../components/ui/Section';
import { PropertyRow } from '../../../components/ui/PropertyRow';

export function ContainerSection({
  componentType,
  nodeProps,
}: {
  componentType: string;
  nodeProps: Record<string, unknown>;
}) {
  const direction = (nodeProps.direction as string) ?? '';
  const gap = (nodeProps.gap as string | number) ?? '';
  const columns = (nodeProps.columns as number) ?? '';
  const padding = (nodeProps.padding as string | number) ?? '';

  return (
    <Section title="Container">
      {componentType === 'Grid' && (
        <PropertyRow label="Columns">
          <span className="font-mono text-[12px] text-ink">{columns || '—'}</span>
        </PropertyRow>
      )}
      <PropertyRow label="Direction">
        <span className="font-mono text-[12px] text-ink">{direction || '—'}</span>
      </PropertyRow>
      <PropertyRow label="Gap">
        <span className="font-mono text-[12px] text-ink">{gap || '—'}</span>
      </PropertyRow>
      <PropertyRow label="Padding">
        <span className="font-mono text-[12px] text-ink">{padding || '—'}</span>
      </PropertyRow>
    </Section>
  );
}
