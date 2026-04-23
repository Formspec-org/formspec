/** @filedesc Properties panel section for field-level config: initial value, decimal, and money flags. */
import { Section } from '../../../components/ui/Section';
import { propertyHelp, type Project } from '@formspec-org/studio-core';
import { PropInput } from './shared';
import { AddBehaviorMenu } from '../../../components/ui/AddBehaviorMenu';
import { BindCard } from '../../../components/ui/BindCard';
import { InlineExpression } from '../../../components/ui/InlineExpression';
import { PrePopulateCard } from '../../../components/ui/PrePopulateCard';
import type { FormItem } from '@formspec-org/types';

export function FieldConfigSection({
  path,
  item,
  project,
  binds,
  existingBehaviorTypes,
  isDecimalLike,
  isMoney,
}: {
  path: string;
  item: FormItem;
  project: Project;
  binds: Record<string, string>;
  existingBehaviorTypes: string[];
  isDecimalLike: boolean;
  isMoney: boolean;
}) {
  return (
    <Section title="Field Config">
      <div className="space-y-1 mt-1 mb-4">
        <BindCard bindType="Initial Value" expression={item.initialValue != null ? String(item.initialValue) : ''}>
          <InlineExpression
            value={item.initialValue != null ? String(item.initialValue) : ''}
            onSave={(value) => {
              project.updateItem(path, { initialValue: value || null });
            }}
            placeholder="Click to add initial value (prefix = for FEL)"
          />
        </BindCard>

        {item.prePopulate && (
          <PrePopulateCard
            value={item.prePopulate}
            onChange={(val) => {
              project.updateItem(path, { prePopulate: val });
            }}
            onRemove={() => {
              project.updateItem(path, { prePopulate: null });
            }}
            itemKey={path.split('.').pop()}
          />
        )}

        {binds.calculate != null && (
          <BindCard
            bindType="calculate"
            expression={binds.calculate}
            onRemove={() => {
              project.updateItem(path, { calculate: null });
            }}
          >
            <InlineExpression
              value={binds.calculate}
              onSave={(value) => {
                project.updateItem(path, { calculate: value || null });
              }}
              placeholder="Click to add expression"
            />
          </BindCard>
        )}

        <AddBehaviorMenu
          label="Add Calculation / Pre-population"
          existingTypes={existingBehaviorTypes}
          allowedTypes={['calculate', 'pre-populate']}
          onAdd={(type: string) => {
            if (type === 'pre-populate') {
              project.updateItem(path, { prePopulate: { instance: '', path: '' } });
            } else if (type === 'calculate') {
              project.updateItem(path, { calculate: '' });
            }
          }}
          className="mt-1"
        />
      </div>

      {isDecimalLike && typeof item.precision === 'number' && (
        <PropInput
          path={path}
          property="precision"
          label="Precision"
          type="number"
          min={0}
          value={item.precision}
          project={project}
          help={propertyHelp.precision}
        />
      )}

      {isMoney && typeof item.currency === 'string' && (
        <PropInput
          path={path}
          property="currency"
          label="Currency"
          value={item.currency}
          project={project}
          help={propertyHelp.currency}
        />
      )}

      {typeof item.prefix === 'string' && (
        <PropInput
          path={path}
          property="prefix"
          label="Prefix"
          value={item.prefix}
          project={project}
          help={propertyHelp.prefix}
        />
      )}
      {typeof item.suffix === 'string' && (
        <PropInput
          path={path}
          property="suffix"
          label="Suffix"
          value={item.suffix}
          project={project}
          help={propertyHelp.suffix}
        />
      )}
      {typeof item.semanticType === 'string' && (
        <PropInput
          path={path}
          property="semanticType"
          label="Semantic Type"
          value={item.semanticType}
          project={project}
          help={propertyHelp.semanticType}
        />
      )}
    </Section>
  );
}
