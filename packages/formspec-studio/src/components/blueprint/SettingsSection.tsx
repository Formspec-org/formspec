/** @filedesc Blueprint section displaying top-level form settings (title, version, status, page mode). */
import { useDefinition } from '../../state/useDefinition';
import { PropertyRow } from '../ui/PropertyRow';
import { Pill } from '../ui/Pill';

export function SettingsSection() {
  const definition = useDefinition();
  const def = definition as any;
  const presentation = def.formPresentation ?? {};

  return (
    <div className="space-y-0.5">
      <PropertyRow label="Title">{def.title ?? '—'}</PropertyRow>
      <PropertyRow label="Version">{def.version}</PropertyRow>
      {def.status && (
        <PropertyRow label="Status">
          <Pill text={def.status} color="accent" size="sm" />
        </PropertyRow>
      )}
      {presentation.pageMode && (
        <PropertyRow label="Page Mode">{presentation.pageMode}</PropertyRow>
      )}
      {def.nonRelevantBehavior && (
        <PropertyRow label="Non-Relevant">{def.nonRelevantBehavior}</PropertyRow>
      )}
    </div>
  );
}
