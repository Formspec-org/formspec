/** @filedesc Properties panel section for editing item label, description, and hint text. */
import { useState } from 'react';
import { Section } from '../../../components/ui/Section';
import { propertyHelp, type Project } from '@formspec-org/studio-core';
import { AddPlaceholder, PropInput } from './shared';
import type { FormItem } from '@formspec-org/types';

export function ContentSection({
  path,
  item,
  project,
}: {
  path: string;
  item: FormItem;
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
              onCleared={() => setShowDescription(false)}
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
              onCleared={() => setShowHint(false)}
            />
          )}
        </>
      )}
    </Section>
  );
}
