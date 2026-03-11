import { useMapping } from '../../state/useMapping';
import { Section } from '../../components/ui/Section';
import { Pill } from '../../components/ui/Pill';

export function MappingConfig() {
  const mapping = useMapping();

  return (
    <Section title="Configuration">
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">Direction</span>
          <Pill text={mapping?.direction ?? 'unset'} color="accent" />
        </div>
        {mapping?.definitionRef && (
          <div className="flex items-center justify-between">
            <span className="text-muted">Definition</span>
            <span className="font-mono text-xs text-ink">{mapping.definitionRef}</span>
          </div>
        )}
        {mapping?.targetSchema && (
          <div className="flex items-center justify-between">
            <span className="text-muted">Target Schema</span>
            <span className="text-xs text-ink">
              {Object.keys(mapping.targetSchema).length} properties
            </span>
          </div>
        )}
      </div>
    </Section>
  );
}
