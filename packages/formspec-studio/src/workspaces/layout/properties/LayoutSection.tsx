/** @filedesc Layout properties section for CSS Grid placement (column span, row span). */
import { Section } from '../../../components/ui/Section';
import { PropertyRow } from '../../../components/ui/PropertyRow';

export function LayoutSection({
  nodeProps,
}: {
  nodeProps: Record<string, unknown>;
}) {
  const colSpan = (nodeProps.gridColumnSpan as number) ?? '';
  const rowSpan = (nodeProps.gridRowSpan as number) ?? '';

  return (
    <Section title="Layout">
      <PropertyRow label="Column Span">
        <span className="font-mono text-[12px] text-ink">{colSpan || '—'}</span>
      </PropertyRow>
      <PropertyRow label="Row Span">
        <span className="font-mono text-[12px] text-ink">{rowSpan || '—'}</span>
      </PropertyRow>
    </Section>
  );
}
