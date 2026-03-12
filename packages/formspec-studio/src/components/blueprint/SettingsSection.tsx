import { useEffect, useRef, useState } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useDispatch } from '../../state/useDispatch';
import { Section } from '../ui/Section';
import { PropertyRow } from '../ui/PropertyRow';
import { Pill } from '../ui/Pill';

export function SettingsSection() {
  const definition = useDefinition();
  const dispatch = useDispatch();
  const def = definition as any;
  const presentation = def.formPresentation ?? {};
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(def.title ?? '');
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftTitle(def.title ?? '');
  }, [def.title]);

  useEffect(() => {
    if (!editingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [editingTitle]);

  const commitTitle = () => {
    dispatch({
      type: 'definition.setDefinitionProperty',
      payload: {
        property: 'title',
        value: draftTitle.trim() || undefined,
      },
    });
    setEditingTitle(false);
  };

  return (
    <Section title="Settings">
      <div className="space-y-3">
        <Section title="Definition Metadata">
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
            {def.title && (
              <PropertyRow label="Title">
                {editingTitle ? (
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={draftTitle}
                    aria-label="Form title"
                    className="w-full rounded-[3px] border border-accent/30 bg-surface px-1 py-0.5 text-right outline-none"
                    onChange={(event) => setDraftTitle(event.currentTarget.value)}
                    onBlur={commitTitle}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitTitle();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setDraftTitle(def.title ?? '');
                        setEditingTitle(false);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    title={def.title}
                    className="w-full truncate text-right text-inherit cursor-pointer"
                    onClick={() => setEditingTitle(true)}
                  >
                    {def.title}
                  </button>
                )}
              </PropertyRow>
            )}
            {def.description && <PropertyRow label="Description">{def.description}</PropertyRow>}
          </div>
        </Section>

        {/* Presentation Defaults */}
        {Object.keys(presentation).length > 0 && (
          <Section title="Presentation Defaults">
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
          </Section>
        )}

        {/* Behavioral Defaults */}
        {def.nonRelevantBehavior && (
          <Section title="Behavioral Defaults">
            <PropertyRow label="Non-Relevant">{def.nonRelevantBehavior}</PropertyRow>
          </Section>
        )}

        {/* Extensions */}
        {(() => {
          const extKeys = Object.keys(def).filter((k: string) => k.startsWith('x-'));
          if (extKeys.length === 0) return null;
          return (
            <Section title="Extensions">
              <div className="space-y-0.5">
                {extKeys.map((key: string) => (
                  <PropertyRow key={key} label={key}>
                    {typeof def[key] === 'object' ? JSON.stringify(def[key]) : String(def[key])}
                  </PropertyRow>
                ))}
              </div>
            </Section>
          );
        })()}
      </div>
    </Section>
  );
}
