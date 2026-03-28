/** @filedesc Inline bind rule editors for the Editor properties panel (required, relevant, readonly, constraint, constraintMessage). */
import { Section } from '../../../components/ui/Section';
import { BindCard } from '../../../components/ui/BindCard';
import { InlineExpression } from '../../../components/ui/InlineExpression';
import { AddBehaviorMenu } from '../../../components/ui/AddBehaviorMenu';
import { humanizeFEL, type Project } from '@formspec-org/studio-core';

export function BindsInlineSection({
  path,
  binds,
  existingBehaviorTypes,
  project,
}: {
  path: string;
  binds: Record<string, string>;
  existingBehaviorTypes: string[];
  project: Project;
}) {
  return (
    <Section title="Behavior Rules">
      <div className="space-y-1">
        {Object.entries(binds)
          .filter(([type, expr]) => type !== 'calculate' && type !== 'constraintMessage' && expr !== null && expr !== undefined)
          .map(([bindType, expression]) => (
            <BindCard
              key={bindType}
              bindType={bindType}
              expression={expression}
              humanized={humanizeFEL(expression)}
              message={bindType === 'constraint' ? binds.constraintMessage : undefined}
              onRemove={() => {
                project.updateItem(path, { [bindType]: null });
              }}
            >
              <InlineExpression
                value={expression}
                onSave={(value) => {
                  project.updateItem(path, { [bindType]: value ?? null });
                }}
                placeholder="Click to add expression"
              />
            </BindCard>
          ))}

        <AddBehaviorMenu
          existingTypes={existingBehaviorTypes}
          allowedTypes={['relevant', 'required', 'readonly', 'constraint']}
          onAdd={(type: string) => {
            project.updateItem(path, { [type]: 'true' });
          }}
          className="mt-2"
        />
      </div>
    </Section>
  );
}
