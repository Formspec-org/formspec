import { Section } from '../../../components/ui/Section';
import { PropertyRow } from '../../../components/ui/PropertyRow';
import { BindCard } from '../../../components/ui/BindCard';
import { ShapeCard } from '../../../components/ui/ShapeCard';
import { HelpTip } from '../../../components/ui/HelpTip';
import { InlineExpression } from '../../../components/ui/InlineExpression';
import { dataTypeInfo, propertyHelp } from '../../../lib/field-helpers';
import { humanizeFEL } from '../../../lib/humanize';
import { ContentSection } from './ContentSection';
import { WidgetHintSection } from './WidgetHintSection';
import { AppearanceSection } from './AppearanceSection';
import { FieldConfigSection } from './FieldConfigSection';
import { GroupConfigSection } from './GroupConfigSection';
import { OptionsSection } from './OptionsSection';
import { AddBehaviorMenu } from '../../../components/ui/AddBehaviorMenu';
import { PrePopulateCard } from '../../../components/ui/PrePopulateCard';
import type { Project } from 'formspec-studio-core';

export function SelectedItemProperties({
  item,
  path,
  selectedType,
  binds,
  shapes,
  keyInputRef,
  showActions,
  project,
  onDuplicate,
  onDelete,
}: {
  item: any;
  path: string;
  selectedType: string | null;
  binds: Record<string, string>;
  shapes: any[];
  keyInputRef: React.RefObject<HTMLInputElement | null>;
  showActions: boolean;
  project: Project;
  onDuplicate: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const dataType = item.dataType as string | undefined;
  const info = dataType ? dataTypeInfo(dataType) : null;
  const currentKey = path.split('.').pop() || path;
  const isField = item.type === 'field';
  const isGroup = item.type === 'group';
  const isChoice = dataType === 'choice' || dataType === 'multiChoice' || dataType === 'select1' || dataType === 'select';
  const isDecimalLike = dataType === 'decimal' || dataType === 'money';
  const isMoney = dataType === 'money';

  const existingBehaviorTypes = [
    ...Object.keys(binds).filter(k => binds[k] !== null && binds[k] !== undefined),
    ...(item.prePopulate ? ['pre-populate'] : [])
  ];

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {info && (
            <div className={`w-5.5 h-5.5 rounded-[3px] bg-subtle flex items-center justify-center font-mono font-bold text-[10px] ${info.color}`}>
              {info.icon}
            </div>
          )}
          <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">Properties</h2>
        </div>
        <div className="font-mono text-[12px] text-muted truncate">
          {(item.label as string) || currentKey}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1">
        <Section title="Identity">
          <div className="space-y-1.5 mb-2">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">
              <HelpTip text={propertyHelp.key}>Key</HelpTip>
            </label>
            <input
              key={path}
              ref={keyInputRef}
              type="text"
              aria-label="Key"
              className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
              defaultValue={currentKey}
            />
          </div>
          <div className="space-y-1.5 mb-2">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">
              <HelpTip text={propertyHelp.label}>Label</HelpTip>
            </label>
            <input
              key={`${path}-label`}
              type="text"
              aria-label="Label"
              className="w-full px-2 py-1 text-[13px] border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
              defaultValue={(item.label as string) || ''}
              onBlur={(event) => {
                project.updateItem(path, { label: event.currentTarget.value || null });
              }}
            />
          </div>
          <PropertyRow label="Type" help={propertyHelp.type}>{selectedType || item.type}</PropertyRow>
          {info && (
            <PropertyRow label="DataType" color={info.color} help={propertyHelp.dataType}>
              <span className="mr-1">{info.icon}</span>
              {info.label}
            </PropertyRow>
          )}
        </Section>

        <ContentSection path={path} item={item} project={project} />
        <WidgetHintSection path={path} item={item} project={project} />
        <AppearanceSection itemKey={currentKey} itemType={item.type} itemDataType={dataType} />

        {isField && (
          <FieldConfigSection
            path={path}
            item={item}
            project={project}
            binds={binds}
            existingBehaviorTypes={existingBehaviorTypes}
            isDecimalLike={isDecimalLike}
            isMoney={isMoney}
          />
        )}

        {isGroup && (
          <GroupConfigSection path={path} item={item} project={project} />
        )}

        {isField && isChoice && (
          <OptionsSection path={path} item={item} project={project} />
        )}

        <Section title="Behavior Rules">
          <div className="space-y-1">

            {Object.entries(binds)
              .filter(([type, expr]) => type !== 'calculate' && expr !== null && expr !== undefined)
              .map(([bindType, expression]) => (
                <BindCard
                  key={bindType}
                  bindType={bindType}
                  expression={expression}
                  humanized={humanizeFEL(expression)}
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

        {shapes.length > 0 && (
          <Section title="Validation Shapes">
            <div className="space-y-1">
              {shapes.map((shape, index) => (
                <button
                  key={index}
                  type="button"
                  className="w-full text-left focus:outline-none focus:ring-1 focus:ring-accent rounded transition-transform active:scale-[0.98]"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', { detail: { tab: 'Logic' } }));
                  }}
                >
                  <ShapeCard
                    name={shape.name}
                    severity={shape.severity}
                    constraint={shape.constraint}
                    message={shape.message as string}
                    code={shape.code as string}
                  />
                </button>
              ))}
            </div>
          </Section>
        )}
      </div>

      {showActions && (
        <div className="p-3.5 border-t border-border bg-surface shrink-0 flex gap-2">
          <button
            className="flex-1 py-1.5 border border-border rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-subtle transition-colors cursor-pointer"
            onClick={() => onDuplicate(path)}
          >
            Duplicate
          </button>
          <button
            className="flex-1 py-1.5 border border-error/20 rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest text-error hover:bg-error/5 transition-colors cursor-pointer"
            onClick={() => onDelete(path)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
