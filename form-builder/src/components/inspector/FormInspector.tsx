import type { Signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { BrandPanel } from '../brand/BrandPanel';
import { Collapsible } from '../controls/Collapsible';
import { TextInput } from '../controls/TextInput';
import { FormRulesBuilder } from '../shapes/FormRulesBuilder';
import { VariablesPanel } from '../variables/VariablesPanel';
import { MappingEditor } from '../mapping/MappingEditor';
import { ExtensionBrowser } from '../extensions/ExtensionBrowser';
import { ImportExportPanel } from '../io/ImportExportPanel';
import { isLinkedSubform } from '../subform/LinkedBadge';
import { SubFormImport } from '../subform/SubFormImport';
import { VersionPanel } from '../versioning/VersionPanel';
import {
  setDefinitionProperty,
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
      <p class="inspector-content__title">Form Inspector</p>
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
