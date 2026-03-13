import { Section } from '../../../components/ui/Section';
import { propertyHelp } from '../../../lib/field-helpers';
import { PropInput } from './shared';
import { AddBehaviorMenu } from '../../../components/ui/AddBehaviorMenu';
import { BindCard } from '../../../components/ui/BindCard';
import { PrePopulateCard } from '../../../components/ui/PrePopulateCard';

export function FieldConfigSection({
  path,
  item,
  dispatch,
  binds,
  existingBehaviorTypes,
  isDecimalLike,
  isMoney,
}: {
  path: string;
  item: any;
  dispatch: (command: any) => any;
  binds: Record<string, any>;
  existingBehaviorTypes: string[];
  isDecimalLike: boolean;
  isMoney: boolean;
}) {
  return (
    <Section title="Field Config">
      <div className="space-y-1 mt-1 mb-4">
        <BindCard bindType="Initial Value" expression={item.initialValue != null ? String(item.initialValue) : ''}>
          <input
            id={`${path}-initialValue`}
            aria-label="Initial Value"
            className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
            defaultValue={item.initialValue != null ? String(item.initialValue) : ''}
            onBlur={(e) => {
              dispatch({
                type: 'definition.setItemProperty',
                payload: { path, property: 'initialValue', value: e.currentTarget.value || null },
              });
            }}
            placeholder="No default value"
          />
        </BindCard>

        {item.prePopulate && (
          <PrePopulateCard
            value={item.prePopulate}
            onChange={(val) => {
              dispatch({
                type: 'definition.setItemProperty',
                payload: { path, property: 'prePopulate', value: val },
              });
            }}
            onRemove={() => {
              dispatch({
                type: 'definition.setItemProperty',
                payload: { path, property: 'prePopulate', value: null },
              });
            }}
          />
        )}

        {binds.calculate != null && (
          <BindCard
            bindType="calculate"
            expression={binds.calculate}
            onRemove={() => {
              dispatch({
                type: 'definition.setBind',
                payload: { path, properties: { calculate: null } },
              });
            }}
          >
            <div className="px-2 py-1 text-[13px] font-mono bg-subtle/50 rounded border border-border/50 text-ink/80">
              {binds.calculate || <span className="text-muted italic">No expression</span>}
            </div>
          </BindCard>
        )}

        <AddBehaviorMenu
          label="Add Calculation / Pre-population"
          existingTypes={existingBehaviorTypes}
          allowedTypes={['calculate', 'pre-populate']}
          onAdd={(type: string) => {
            if (type === 'pre-populate') {
              dispatch({
                type: 'definition.setItemProperty',
                payload: { path, property: 'prePopulate', value: { instance: '', path: '' } },
              });
            } else if (type === 'calculate') {
              dispatch({
                type: 'definition.setBind',
                payload: { path, properties: { calculate: '' } },
              });
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
          dispatch={dispatch}
          help={propertyHelp.precision}
        />
      )}

      {isMoney && typeof item.currency === 'string' && (
        <PropInput
          path={path}
          property="currency"
          label="Currency"
          value={item.currency}
          dispatch={dispatch}
          help={propertyHelp.currency}
        />
      )}

      {typeof item.prefix === 'string' && (
        <PropInput
          path={path}
          property="prefix"
          label="Prefix"
          value={item.prefix}
          dispatch={dispatch}
          help={propertyHelp.prefix}
        />
      )}
      {typeof item.suffix === 'string' && (
        <PropInput
          path={path}
          property="suffix"
          label="Suffix"
          value={item.suffix}
          dispatch={dispatch}
          help={propertyHelp.suffix}
        />
      )}
      {typeof item.semanticType === 'string' && (
        <PropInput
          path={path}
          property="semanticType"
          label="Semantic Type"
          value={item.semanticType}
          dispatch={dispatch}
          help={propertyHelp.semanticType}
        />
      )}
    </Section>
  );
}
