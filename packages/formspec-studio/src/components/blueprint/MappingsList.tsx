import { useProjectState } from '../../state/useProjectState';
import { Section } from '../ui/Section';
import { Pill } from '../ui/Pill';

export function MappingsList() {
  const state = useProjectState();
  const mapping = state.mapping;
  const rules = (mapping.rules as unknown[] | undefined) ?? [];
  const direction = mapping.direction ?? 'bidirectional';

  if (rules.length === 0) {
    return (
      <Section title="Mappings">
        <p className="text-xs text-muted py-2">No mapping rules defined</p>
      </Section>
    );
  }

  return (
    <Section title="Mappings">
      <div className="space-y-1 py-1">
        <div className="flex items-center gap-2">
          <Pill text={`${rules.length} rule${rules.length === 1 ? '' : 's'}`} color="accent" size="sm" />
          <Pill text={direction} color="muted" size="sm" />
        </div>
      </div>
    </Section>
  );
}
