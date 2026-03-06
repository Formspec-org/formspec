import type { Signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { BrandPanel } from '../brand/BrandPanel';
import { Collapsible } from '../controls/Collapsible';
import { Dropdown } from '../controls/Dropdown';
import { KeyValueEditor } from '../controls/KeyValueEditor';
import { TextInput } from '../controls/TextInput';
import { FormRulesBuilder } from '../shapes/FormRulesBuilder';
import { VariablesPanel } from '../variables/VariablesPanel';
import { MappingEditor } from '../mapping/MappingEditor';
import { ExtensionBrowser } from '../extensions/ExtensionBrowser';
import { ImportExportPanel } from '../io/ImportExportPanel';
import { CustomComponentRegistryEditor } from './CustomComponentRegistryEditor';
import { isLinkedSubform } from '../subform/LinkedBadge';
import { OptionSetsPanel } from '../optionsets/OptionSetsPanel';
import { InstancesPanel } from '../instances/InstancesPanel';
import { SubFormImport } from '../subform/SubFormImport';
import { VersionPanel } from '../versioning/VersionPanel';
import {
  setComponentDocumentProperty,
  setComponentTokens,
  setDefinitionProperty,
  setFormPresentationProperty,
  setFormTitle,
  setInspectorSectionOpen
} from '../../state/mutations';
import { deriveVariableDependencies } from '../../state/derived';
import type { ProjectState } from '../../state/project';

export interface FormInspectorProps {
  project: Signal<ProjectState>;
}

export function FormInspector(props: FormInspectorProps) {
  const definition = props.project.value.definition;
  const versioning = props.project.value.versioning;
  const variableDependencies = useMemo(
    () => deriveVariableDependencies(definition),
    [definition]
  );
  const linkedSubformCount = useMemo(
    () => countLinkedSubforms(definition.items),
    [definition.items]
  );

  const setSectionOpen = (sectionId: string, open: boolean) => {
    setInspectorSectionOpen(props.project, `form:${sectionId}`, open);
  };
  const FORM_SECTION_DEFAULTS: Record<string, boolean> = { metadata: true };
  const isSectionOpen = (sectionId: string) =>
    props.project.value.uiState.inspectorSections[`form:${sectionId}`] ?? FORM_SECTION_DEFAULTS[sectionId] ?? false;

  return (
    <div class="inspector-content" data-testid="form-inspector">
      <Collapsible
        id="form-metadata"
        title="Metadata"
        open={isSectionOpen('metadata')}
        onToggle={(open) => {
          setSectionOpen('metadata', open);
        }}
      >
        <TextInput
          label="Title"
          value={definition.title}
          testId="form-meta-title-input"
          onInput={(value) => {
            setFormTitle(props.project, value);
          }}
        />
        <TextInput
          label="Name (machine identifier)"
          value={typeof definition.name === 'string' ? definition.name : undefined}
          testId="form-name-input"
          onInput={(value) => {
            setDefinitionProperty(props.project, 'name', value);
          }}
        />
        <TextInput
          label="Description"
          value={typeof definition.description === 'string' ? definition.description : undefined}
          testId="form-description-input"
          onInput={(value) => {
            setDefinitionProperty(props.project, 'description', value);
          }}
        />
        <TextInput
          label="Definition URL"
          value={definition.url}
          testId="form-url-input"
          onInput={(value) => {
            setDefinitionProperty(props.project, 'url', value);
          }}
        />
        <TextInput
          label="Version"
          value={definition.version}
          testId="form-version-input"
          onInput={(value) => {
            setDefinitionProperty(props.project, 'version', value);
          }}
        />
        <TextInput
          label="Date"
          value={typeof definition.date === 'string' ? definition.date : undefined}
          testId="form-date-input"
          onInput={(value) => {
            setDefinitionProperty(props.project, 'date', value);
          }}
        />
        <Dropdown
          label="Status"
          value={typeof definition.status === 'string' ? definition.status : ''}
          testId="form-status-input"
          options={[
            { value: '', label: 'Not set' },
            { value: 'draft', label: 'Draft' },
            { value: 'active', label: 'Active' },
            { value: 'retired', label: 'Retired' }
          ]}
          onChange={(value) => {
            setDefinitionProperty(props.project, 'status', value || undefined);
          }}
        />
        <Dropdown
          label="Version algorithm"
          value={typeof definition.versionAlgorithm === 'string' ? definition.versionAlgorithm : ''}
          testId="form-version-algorithm-input"
          options={[
            { value: '', label: 'Default (semver)' },
            { value: 'semver', label: 'Semantic versioning' },
            { value: 'date', label: 'Date-based' },
            { value: 'integer', label: 'Integer' },
            { value: 'natural', label: 'Natural' }
          ]}
          onChange={(value) => {
            setDefinitionProperty(props.project, 'versionAlgorithm', value || undefined);
          }}
        />
        <Dropdown
          label="When hidden (form default)"
          value={typeof (definition.formPresentation as Record<string, unknown> | undefined)?.nonRelevantBehavior === 'string'
            ? (definition.formPresentation as Record<string, unknown>).nonRelevantBehavior as string
            : ''}
          testId="form-non-relevant-input"
          options={[
            { value: '', label: 'Default' },
            { value: 'remove', label: 'Exclude from response' },
            { value: 'empty', label: 'Submit as empty' },
            { value: 'keep', label: 'Keep last value' }
          ]}
          onChange={(value) => {
            setFormPresentationProperty(props.project, 'nonRelevantBehavior', value || undefined);
          }}
        />
        <TextInput
          label="Derived from (URL)"
          value={typeof (definition as Record<string, unknown>).derivedFrom === 'string'
            ? (definition as Record<string, unknown>).derivedFrom as string
            : undefined}
          testId="form-derived-from-input"
          onInput={(value) => {
            setDefinitionProperty(props.project, 'derivedFrom', value);
          }}
        />
      </Collapsible>

      <Collapsible
        id="form-import-export"
        title="Import / Export"
        open={isSectionOpen('import-export')}
        onToggle={(open) => {
          setSectionOpen('import-export', open);
        }}
      >
        <ImportExportPanel project={props.project} />
      </Collapsible>

      <Collapsible
        id="form-version"
        title="Version"
        open={isSectionOpen('version')}
        summary={
          versioning.releases.length
            ? `v${versioning.releases[versioning.releases.length - 1]?.version}`
            : null
        }
        onToggle={(open) => {
          setSectionOpen('version', open);
        }}
      >
        <VersionPanel project={props.project} />
      </Collapsible>

      <BrandPanel project={props.project} />

      <Collapsible
        id="form-component-doc"
        title="Component Document"
        open={isSectionOpen('component-doc')}
        onToggle={(open) => {
          setSectionOpen('component-doc', open);
        }}
      >
        <TextInput
          label="Name (identifier)"
          value={typeof props.project.value.component.name === 'string' ? props.project.value.component.name : undefined}
          testId="component-doc-name-input"
          onInput={(value) => {
            setComponentDocumentProperty(props.project, 'name', value);
          }}
        />
        <TextInput
          label="Title"
          value={typeof props.project.value.component.title === 'string' ? props.project.value.component.title : undefined}
          testId="component-doc-title-input"
          onInput={(value) => {
            setComponentDocumentProperty(props.project, 'title', value);
          }}
        />
        <TextInput
          label="Description"
          value={typeof props.project.value.component.description === 'string' ? props.project.value.component.description : undefined}
          testId="component-doc-description-input"
          onInput={(value) => {
            setComponentDocumentProperty(props.project, 'description', value);
          }}
        />
        <KeyValueEditor
          label="Design tokens"
          value={toComponentTokens(props.project.value.component)}
          valuePlaceholder="$token.key or value"
          testId="component-doc-tokens"
          onInput={(value) => {
            setComponentTokens(props.project, value);
          }}
        />
        <CustomComponentRegistryEditor project={props.project} />
      </Collapsible>

      <Collapsible
        id="form-option-sets"
        title="Option Sets"
        open={isSectionOpen('option-sets')}
        summary={
          Object.keys((definition.optionSets as Record<string, unknown> | undefined) ?? {}).length > 0
            ? `${Object.keys((definition.optionSets as Record<string, unknown> | undefined) ?? {}).length} sets`
            : null
        }
        onToggle={(open) => {
          setSectionOpen('option-sets', open);
        }}
      >
        <OptionSetsPanel project={props.project} />
      </Collapsible>

      <Collapsible
        id="form-instances"
        title="Secondary Data Sources"
        open={isSectionOpen('instances')}
        summary={
          Object.keys((definition as Record<string, unknown>).instances as Record<string, unknown> | undefined ?? {}).length > 0
            ? `${Object.keys((definition as Record<string, unknown>).instances as Record<string, unknown> ?? {}).length} instances`
            : null
        }
        onToggle={(open) => {
          setSectionOpen('instances', open);
        }}
      >
        <InstancesPanel project={props.project} />
      </Collapsible>

      <Collapsible
        id="form-variables"
        title="Variables"
        open={isSectionOpen('variables')}
        summary={
          definition.variables?.length
            ? `${definition.variables.length} variables`
            : null
        }
        onToggle={(open) => {
          setSectionOpen('variables', open);
        }}
      >
        <VariablesPanel project={props.project} dependencies={variableDependencies} />
      </Collapsible>

      <Collapsible
        id="form-rules"
        title="Form Rules"
        open={isSectionOpen('rules')}
        summary={
          definition.shapes?.length
            ? `${definition.shapes?.length ?? 0} shapes`
            : null
        }
        onToggle={(open) => {
          setSectionOpen('rules', open);
        }}
      >
        <FormRulesBuilder project={props.project} />
      </Collapsible>

      <Collapsible
        id="form-subforms"
        title="Sub-forms"
        open={isSectionOpen('subforms')}
        summary={linkedSubformCount ? `${linkedSubformCount} linked` : null}
        onToggle={(open) => {
          setSectionOpen('subforms', open);
        }}
      >
        <SubFormImport project={props.project} />
      </Collapsible>

      <Collapsible
        id="form-extensions"
        title="Extensions"
        open={isSectionOpen('extensions')}
        summary={
          props.project.value.extensions.registries.length
            ? `${props.project.value.extensions.registries.length} registries`
            : null
        }
        onToggle={(open) => {
          setSectionOpen('extensions', open);
        }}
      >
        <ExtensionBrowser project={props.project} />
      </Collapsible>

      <Collapsible
        id="form-mapping"
        title="Mapping"
        open={isSectionOpen('mapping')}
        summary={
          definition.items.length
            ? `${props.project.value.mapping.rules.length} rules`
            : null
        }
        onToggle={(open) => {
          setSectionOpen('mapping', open);
        }}
      >
        <MappingEditor project={props.project} />
      </Collapsible>
    </div>
  );
}

function countLinkedSubforms(items: ProjectState['definition']['items']): number {
  let count = 0;
  for (const item of items) {
    if (item.type === 'group') {
      if (isLinkedSubform(item)) {
        count += 1;
      }
      count += countLinkedSubforms(item.children ?? []);
    }
  }
  return count;
}

function toComponentTokens(component: ProjectState['component']): Record<string, string | number> | undefined {
  const raw = (component as Record<string, unknown>).tokens;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return undefined;
  }
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' || typeof v === 'number') {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
