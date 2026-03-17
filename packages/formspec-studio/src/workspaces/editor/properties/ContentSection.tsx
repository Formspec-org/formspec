/** @filedesc Properties panel section for editing item label, description, and hint text. */
import { useState } from 'react';
import { Section } from '../../../components/ui/Section';
import { propertyHelp } from '../../../lib/field-helpers';
import { AddPlaceholder, PropInput } from './shared';
import type { Project } from 'formspec-studio-core';

export function ContentSection({
  path,
  item,
  project,
}: {
  path: string;
  item: any;
  project: Project;
}) {
  const [showDescription, setShowDescription] = useState(!!item.description);
  const [showHint, setShowHint] = useState(!!item.hint);

  const descriptionPlaceholder = !showDescription && !item.description;
  const hintPlaceholder = !showHint && !item.hint;

  return (
    <Section title="Content">
      {descriptionPlaceholder && hintPlaceholder ? (
        <div className="flex gap-3 mb-2">
          <AddPlaceholder label="description" onAdd={() => setShowDescription(true)} help={propertyHelp.description} />
          <AddPlaceholder label="hint" onAdd={() => setShowHint(true)} help={propertyHelp.hint} />
        </div>
      ) : (
        <>
          {descriptionPlaceholder ? (
            <AddPlaceholder label="description" onAdd={() => setShowDescription(true)} help={propertyHelp.description} />
          ) : (
            <PropInput
              path={path}
              property="description"
              label="Description"
              value={(item.description as string) ?? ''}
              project={project}
              help={propertyHelp.description}
            />
          )}
          {hintPlaceholder ? (
            <AddPlaceholder label="hint" onAdd={() => setShowHint(true)} help={propertyHelp.hint} />
          ) : (
            <PropInput
              path={path}
              property="hint"
              label="Hint"
              value={(item.hint as string) ?? ''}
              project={project}
              help={propertyHelp.hint}
            />
          )}
        </>
      )}
    </Section>
  );
}
