import { useState } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import { Collapsible } from '../controls/Collapsible';
import { Dropdown } from '../controls/Dropdown';
import { TextInput } from '../controls/TextInput';
import { Toggle } from '../controls/Toggle';
import {
  setFormPresentationProperty,
  setInspectorSectionOpen,
  setThemeDefaultsProperty,
  setThemeDocumentProperty,
  setThemeStylesheets,
  setThemeToken,
  setWizardProperty
} from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { BreakpointEditor } from './BreakpointEditor';
import { ColorPicker } from './ColorPicker';
import { PageLayoutEditor } from './PageLayoutEditor';
import { SelectorRuleEditor } from './SelectorRuleEditor';
import { TokenEditor } from './TokenEditor';

interface BrandPanelProps {
  project: Signal<ProjectState>;
}

export function BrandPanel(props: BrandPanelProps) {
  const definition = props.project.value.definition;
  const formPresentation = (definition.formPresentation as Record<string, unknown> | undefined) ?? {};
  const themeDefaults = (props.project.value.theme.defaults as Record<string, unknown> | undefined) ?? {};
  const tokenCount = Object.keys(props.project.value.theme.tokens ?? {}).length;
  const selectorRuleCount = props.project.value.theme.selectors?.length ?? 0;
  const breakpointCount = Object.keys(props.project.value.theme.breakpoints ?? {}).length;
  const pageCount = props.project.value.theme.pages?.length ?? 0;
  const theme = props.project.value.theme as Record<string, unknown>;
  const themeStylesheets = (theme.stylesheets as string[] | undefined) ?? [];
  const pageMode = typeof formPresentation.pageMode === 'string' ? formPresentation.pageMode : 'single';
  const wizardNode = findWizardNode(props.project.value.component.tree);
  const [newStylesheet, setNewStylesheet] = useState('');

  const setSectionOpen = (sectionId: string, open: boolean) => {
    setInspectorSectionOpen(props.project, `form:${sectionId}`, open);
  };
  const isSectionOpen = (sectionId: string, defaultOpen: boolean) =>
    props.project.value.uiState.inspectorSections[`form:${sectionId}`] ?? defaultOpen;

  return (
    <>
      <Collapsible
        id="theme-identity"
        title="Theme Identity"
        open={isSectionOpen('theme-identity', false)}
        onToggle={(open) => {
          setSectionOpen('theme-identity', open);
        }}
      >
        <TextInput
          label="Name"
          value={typeof theme.name === 'string' ? theme.name : undefined}
          testId="theme-name-input"
          onInput={(value) => {
            setThemeDocumentProperty(props.project, 'name', value ?? '');
          }}
        />
        <TextInput
          label="Title"
          value={typeof theme.title === 'string' ? theme.title : undefined}
          testId="theme-title-input"
          onInput={(value) => {
            setThemeDocumentProperty(props.project, 'title', value ?? '');
          }}
        />
        <TextInput
          label="Description"
          value={typeof theme.description === 'string' ? theme.description : undefined}
          testId="theme-description-input"
          onInput={(value) => {
            setThemeDocumentProperty(props.project, 'description', value ?? '');
          }}
        />
        <TextInput
          label="URL"
          value={typeof theme.url === 'string' ? theme.url : undefined}
          testId="theme-url-input"
          onInput={(value) => {
            setThemeDocumentProperty(props.project, 'url', value ?? '');
          }}
        />
        <Dropdown
          label="Platform"
          value={typeof theme.platform === 'string' ? theme.platform : ''}
          testId="theme-platform-input"
          options={[
            { value: '', label: 'Not set' },
            { value: 'web', label: 'Web' },
            { value: 'mobile', label: 'Mobile' },
            { value: 'pdf', label: 'PDF' },
            { value: 'kiosk', label: 'Kiosk' },
            { value: 'universal', label: 'Universal' }
          ]}
          onChange={(value) => {
            setThemeDocumentProperty(props.project, 'platform', value ?? '');
          }}
        />
        <div class="property-editor">
          <label class="property-editor__label">Stylesheets</label>
          {themeStylesheets.map((url, i) => (
            <div key={i} class="theme-stylesheet-row">
              <span class="theme-stylesheet-row__url">{url}</span>
              <button
                type="button"
                class="theme-stylesheet-row__remove"
                title="Remove"
                onClick={() => {
                  setThemeStylesheets(
                    props.project,
                    themeStylesheets.filter((_, j) => j !== i)
                  );
                }}
              >
                ×
              </button>
            </div>
          ))}
          <div class="theme-stylesheet-add">
            <input
              type="url"
              class="theme-stylesheet-add__input"
              placeholder="https://example.com/style.css"
              value={newStylesheet}
              onInput={(e) => setNewStylesheet((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newStylesheet.trim()) {
                  setThemeStylesheets(props.project, [...themeStylesheets, newStylesheet.trim()]);
                  setNewStylesheet('');
                }
              }}
            />
            <button
              type="button"
              class="theme-stylesheet-add__btn"
              disabled={!newStylesheet.trim()}
              onClick={() => {
                if (newStylesheet.trim()) {
                  setThemeStylesheets(props.project, [...themeStylesheets, newStylesheet.trim()]);
                  setNewStylesheet('');
                }
              }}
            >
              Add
            </button>
          </div>
        </div>
      </Collapsible>

      <Collapsible
        id="brand-style"
        title="Brand"
        open={isSectionOpen('brand-style', true)}
        onToggle={(open) => {
          setSectionOpen('brand-style', open);
        }}
      >
        <ColorPicker
          label="Primary color"
          value={toTokenValue(props.project.value.theme.tokens?.['color.primary'])}
          testId="brand-primary-color-input"
          onInput={(value) => {
            setThemeToken(props.project, 'color.primary', value);
          }}
        />
        <ColorPicker
          label="Secondary color"
          value={toTokenValue(props.project.value.theme.tokens?.['color.secondary'])}
          testId="brand-secondary-color-input"
          onInput={(value) => {
            setThemeToken(props.project, 'color.secondary', value);
          }}
        />
        <ColorPicker
          label="Error color"
          value={toTokenValue(props.project.value.theme.tokens?.['color.error'])}
          testId="brand-error-color-input"
          onInput={(value) => {
            setThemeToken(props.project, 'color.error', value);
          }}
        />
        <TextInput
          label="Font family"
          value={toTokenValue(props.project.value.theme.tokens?.['typography.body.family'])}
          testId="brand-font-family-input"
          onInput={(value) => {
            setThemeToken(props.project, 'typography.body.family', value);
          }}
        />
      </Collapsible>

      <Collapsible
        id="brand-layout"
        title="Layout"
        open={isSectionOpen('brand-layout', true)}
        onToggle={(open) => {
          setSectionOpen('brand-layout', open);
        }}
      >
        <Dropdown
          label="Page mode"
          value={pageMode}
          testId="form-page-mode-input"
          options={[
            { value: 'single', label: 'Single page' },
            { value: 'wizard', label: 'Wizard' },
            { value: 'tabs', label: 'Tabs' }
          ]}
          onChange={(value) => {
            setFormPresentationProperty(props.project, 'pageMode', value);
          }}
        />
        {pageMode === 'wizard' && wizardNode ? (
          <>
            <Toggle
              label="Show wizard progress"
              checked={wizardNode.showProgress !== false}
              testId="form-wizard-show-progress-input"
              onToggle={(value) => {
                setWizardProperty(props.project, 'showProgress', value ? undefined : false);
              }}
            />
            <Toggle
              label="Allow step skipping"
              checked={wizardNode.allowSkip === true}
              testId="form-wizard-allow-skip-input"
              onToggle={(value) => {
                setWizardProperty(props.project, 'allowSkip', value ? true : undefined);
              }}
            />
          </>
        ) : null}
        <Dropdown
          label="Label position"
          value={typeof formPresentation.labelPosition === 'string' ? formPresentation.labelPosition : 'top'}
          testId="form-label-position-input"
          options={[
            { value: 'top', label: 'Top' },
            { value: 'start', label: 'Start' },
            { value: 'hidden', label: 'Hidden' }
          ]}
          onChange={(value) => {
            setFormPresentationProperty(props.project, 'labelPosition', value);
          }}
        />
        <Dropdown
          label="Density"
          value={typeof formPresentation.density === 'string' ? formPresentation.density : 'comfortable'}
          testId="form-density-input"
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'spacious', label: 'Spacious' }
          ]}
          onChange={(value) => {
            setFormPresentationProperty(props.project, 'density', value);
          }}
        />
        <TextInput
          label="Default currency"
          value={typeof formPresentation.defaultCurrency === 'string' ? formPresentation.defaultCurrency : undefined}
          testId="form-default-currency-input"
          onInput={(value) => {
            setFormPresentationProperty(props.project, 'defaultCurrency', value);
          }}
        />
      </Collapsible>

      <Collapsible
        id="brand-defaults"
        title="Global Defaults"
        open={isSectionOpen('brand-defaults', false)}
        onToggle={(open) => {
          setSectionOpen('brand-defaults', open);
        }}
      >
        <Dropdown
          label="Default label position"
          value={typeof themeDefaults.labelPosition === 'string' ? themeDefaults.labelPosition : ''}
          testId="theme-defaults-label-position-input"
          options={[
            { value: '', label: 'Not set' },
            { value: 'top', label: 'Top' },
            { value: 'start', label: 'Start (inline)' },
            { value: 'hidden', label: 'Hidden' }
          ]}
          onChange={(value) => {
            setThemeDefaultsProperty(props.project, 'labelPosition', value || undefined);
          }}
        />
        <TextInput
          label="Default CSS class"
          value={typeof themeDefaults.cssClass === 'string' ? themeDefaults.cssClass : undefined}
          testId="theme-defaults-css-class-input"
          onInput={(value) => {
            setThemeDefaultsProperty(props.project, 'cssClass', value);
          }}
        />
      </Collapsible>

      <Collapsible
        id="brand-style-rules"
        title="Style Rules"
        open={isSectionOpen('brand-style-rules', true)}
        summary={selectorRuleCount > 0 ? `${selectorRuleCount} rules` : null}
        onToggle={(open) => {
          setSectionOpen('brand-style-rules', open);
        }}
      >
        <SelectorRuleEditor project={props.project} />
      </Collapsible>

      <Collapsible
        id="brand-tokens"
        title="Design Tokens"
        open={isSectionOpen('brand-tokens', false)}
        summary={tokenCount > 0 ? `${tokenCount} tokens` : null}
        keepMounted={false}
        onToggle={(open) => {
          setSectionOpen('brand-tokens', open);
        }}
      >
        <TokenEditor project={props.project} />
      </Collapsible>

      <Collapsible
        id="brand-breakpoints"
        title="Breakpoints"
        open={isSectionOpen('brand-breakpoints', false)}
        summary={breakpointCount > 0 ? `${breakpointCount} defined` : null}
        onToggle={(open) => {
          setSectionOpen('brand-breakpoints', open);
        }}
      >
        <BreakpointEditor project={props.project} />
      </Collapsible>

      <Collapsible
        id="brand-pages"
        title="Theme Pages"
        open={isSectionOpen('brand-pages', false)}
        summary={pageCount > 0 ? `${pageCount} pages` : null}
        onToggle={(open) => {
          setSectionOpen('brand-pages', open);
        }}
      >
        <PageLayoutEditor project={props.project} />
      </Collapsible>
    </>
  );
}

function toTokenValue(token: string | number | undefined): string | undefined {
  if (token === undefined) {
    return undefined;
  }
  return String(token);
}

function findWizardNode(tree: ProjectState['component']['tree']) {
  return tree.children?.find((child) => child.component === 'Wizard');
}
