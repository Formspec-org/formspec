import { useDefinition } from '../../state/useDefinition';
import { Section } from '../ui/Section';
import { PropertyRow } from '../ui/PropertyRow';
import { Pill } from '../ui/Pill';

export function SettingsSection() {
  const definition = useDefinition();
  const def = definition as any;
  const presentation = def.presentation ?? def.formPresentation ?? {};

  return (
    <Section title="Settings">
      <div className="space-y-3">
        {/* Definition Metadata */}
        <div>
          <h4 className="text-xs font-medium text-muted mb-1">Definition Metadata</h4>
          <div className="space-y-0.5">
            <PropertyRow label="$formspec">{def.$formspec}</PropertyRow>
            <PropertyRow label="URL">{def.url}</PropertyRow>
            <PropertyRow label="Version">{def.version}</PropertyRow>
            {def.status && (
              <PropertyRow label="Status">
                <Pill text={def.status} color="accent" size="sm" />
              </PropertyRow>
            )}
            {def.name && <PropertyRow label="Name">{def.name}</PropertyRow>}
            {def.title && <PropertyRow label="Title">{def.title}</PropertyRow>}
            {def.description && <PropertyRow label="Description">{def.description}</PropertyRow>}
          </div>
        </div>

        {/* Presentation Defaults */}
        {Object.keys(presentation).length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted mb-1">Presentation Defaults</h4>
            <div className="space-y-0.5">
              {presentation.pageMode && (
                <PropertyRow label="Page Mode">{presentation.pageMode}</PropertyRow>
              )}
              {presentation.labelPosition && (
                <PropertyRow label="Label Position">{presentation.labelPosition}</PropertyRow>
              )}
              {presentation.density && (
                <PropertyRow label="Density">{presentation.density}</PropertyRow>
              )}
              {presentation.defaultCurrency && (
                <PropertyRow label="Currency">{presentation.defaultCurrency}</PropertyRow>
              )}
            </div>
          </div>
        )}

        {/* Behavioral Defaults */}
        {def.nonRelevantBehavior && (
          <div>
            <h4 className="text-xs font-medium text-muted mb-1">Behavioral Defaults</h4>
            <PropertyRow label="Non-Relevant">{def.nonRelevantBehavior}</PropertyRow>
          </div>
        )}

        {/* Extensions */}
        {(() => {
          const extKeys = Object.keys(def).filter((k: string) => k.startsWith('x-'));
          if (extKeys.length === 0) return null;
          return (
            <div>
              <h4 className="text-xs font-medium text-muted mb-1">Extensions</h4>
              <div className="space-y-0.5">
                {extKeys.map((key: string) => (
                  <PropertyRow key={key} label={key}>
                    {typeof def[key] === 'object' ? JSON.stringify(def[key]) : String(def[key])}
                  </PropertyRow>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </Section>
  );
}
