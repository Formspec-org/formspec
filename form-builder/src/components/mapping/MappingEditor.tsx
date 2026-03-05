import type { Signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { Dropdown } from '../controls/Dropdown';
import { TextInput } from '../controls/TextInput';
import {
  addMappingRule,
  deleteMappingRule,
  setMappingProperty,
  setMappingRuleProperty,
  setMappingTargetSchemaProperty,
  type MappingRuleProperty
} from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { MappingRuleDetail } from './MappingRuleDetail';
import { MappingRuleRow } from './MappingRuleRow';
import { RoundTripTest } from './RoundTripTest';

export interface MappingEditorProps {
  project: Signal<ProjectState>;
}

export function MappingEditor(props: MappingEditorProps) {
  const mapping = props.project.value.mapping;
  const rules = mapping.rules ?? [];
  const [selectedRuleIndex, setSelectedRuleIndex] = useState<number | null>(rules.length > 0 ? 0 : null);

  useEffect(() => {
    if (rules.length === 0) {
      setSelectedRuleIndex(null);
      return;
    }

    if (selectedRuleIndex === null || selectedRuleIndex >= rules.length) {
      setSelectedRuleIndex(0);
    }
  }, [rules.length, selectedRuleIndex]);

  const selectedRule = selectedRuleIndex === null ? null : rules[selectedRuleIndex] ?? null;

  const onRuleChange = (ruleIndex: number, property: MappingRuleProperty, value: unknown) => {
    setMappingRuleProperty(props.project, ruleIndex, property, value);
  };

  return (
    <div class="mapping-editor" data-testid="mapping-editor">
      <div class="mapping-editor__meta">
        <TextInput
          label="Mapping Version"
          value={mapping.version}
          testId="mapping-version-input"
          onInput={(value) => {
            setMappingProperty(props.project, 'version', value);
          }}
        />

        <TextInput
          label="Definition Version Range"
          value={mapping.definitionVersion}
          testId="mapping-definition-version-input"
          onInput={(value) => {
            setMappingProperty(props.project, 'definitionVersion', value);
          }}
        />

        <Dropdown
          label="Direction"
          value={mapping.direction ?? 'both'}
          testId="mapping-direction-input"
          options={[
            { value: 'forward', label: 'forward' },
            { value: 'reverse', label: 'reverse' },
            { value: 'both', label: 'both' }
          ]}
          onChange={(value) => {
            setMappingProperty(props.project, 'direction', value);
          }}
        />

        <Dropdown
          label="Target Format"
          value={mapping.targetSchema.format}
          testId="mapping-format-input"
          options={[
            { value: 'json', label: 'json' },
            { value: 'xml', label: 'xml' },
            { value: 'csv', label: 'csv' }
          ]}
          onChange={(value) => {
            setMappingTargetSchemaProperty(props.project, 'format', value);
          }}
        />

        <TextInput
          label="Target Name"
          value={mapping.targetSchema.name}
          testId="mapping-target-name-input"
          onInput={(value) => {
            setMappingTargetSchemaProperty(props.project, 'name', value);
          }}
        />

        {mapping.targetSchema.format === 'xml' ? (
          <TextInput
            label="XML Root Element"
            value={mapping.targetSchema.rootElement}
            testId="mapping-target-root-element-input"
            onInput={(value) => {
              setMappingTargetSchemaProperty(props.project, 'rootElement', value);
            }}
          />
        ) : null}

        <label class="mapping-editor__auto-map">
          <span class="inspector-control__label">Auto map uncovered fields</span>
          <input
            data-testid="mapping-auto-map-input"
            type="checkbox"
            checked={mapping.autoMap ?? false}
            onChange={(event) => {
              setMappingProperty(props.project, 'autoMap', (event.currentTarget as HTMLInputElement).checked);
            }}
          />
        </label>
      </div>

      <div class="mapping-editor__rules">
        <div class="mapping-editor__rules-header">
          <p class="mapping-editor__rules-title">Rules</p>
          <button
            type="button"
            class="mapping-editor__add-rule"
            data-testid="mapping-rule-add-button"
            onClick={() => {
              const ruleIndex = addMappingRule(props.project, {});
              setSelectedRuleIndex(ruleIndex);
            }}
          >
            + Add rule
          </button>
        </div>

        <table class="mapping-rules-table" data-testid="mapping-rules-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Target</th>
              <th>Transform</th>
              <th>Reversible</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <MappingRuleRow
                key={`mapping-rule-${index}-${rule.sourcePath ?? 'none'}-${rule.targetPath ?? 'none'}`}
                index={index}
                rule={rule}
                selected={selectedRuleIndex === index}
                onSelect={() => {
                  setSelectedRuleIndex(index);
                }}
                onDelete={() => {
                  deleteMappingRule(props.project, index);
                  if (selectedRuleIndex === index) {
                    setSelectedRuleIndex(null);
                  }
                }}
                onSourcePathInput={(value) => {
                  onRuleChange(index, 'sourcePath', value);
                }}
                onTargetPathInput={(value) => {
                  onRuleChange(index, 'targetPath', value);
                }}
                onTransformChange={(value) => {
                  onRuleChange(index, 'transform', value);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {selectedRuleIndex !== null && selectedRule ? (
        <MappingRuleDetail
          ruleIndex={selectedRuleIndex}
          rule={selectedRule}
          onChange={(property, value) => {
            onRuleChange(selectedRuleIndex, property, value);
          }}
        />
      ) : (
        <p class="inspector-hint">Select a rule to edit transform details.</p>
      )}

      <RoundTripTest mapping={mapping} />
    </div>
  );
}
