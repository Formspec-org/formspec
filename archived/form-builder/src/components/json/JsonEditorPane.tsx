import type { Signal } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import definitionSchema from '../../../../schemas/definition.schema.json';
import componentSchema from '../../../../schemas/component.schema.json';
import themeSchema from '../../../../schemas/theme.schema.json';
import { setJsonDocument, setJsonEditorOpen, setJsonEditorTab } from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { JsonDiffView, type JsonArtifactKey } from './JsonDiffView';

interface JsonEditorPaneProps {
  project: Signal<ProjectState>;
}

interface SchemaError {
  message: string;
  instancePath: string;
}

interface JsonValidationState {
  parseError: string | null;
  schemaErrors: SchemaError[];
  applyError: string | null;
}

type JsonValidator = ((payload: unknown) => boolean) & { errors?: ErrorObject[] | null };

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false
});

const validators: Record<JsonArtifactKey, JsonValidator> = {
  definition: ajv.compile(definitionSchema as Record<string, unknown>),
  component: ajv.compile(componentSchema as Record<string, unknown>),
  theme: ajv.compile(themeSchema as Record<string, unknown>)
};

const TAB_LABELS: Record<JsonArtifactKey, string> = {
  definition: 'Definition',
  component: 'Component',
  theme: 'Theme'
};

const EMPTY_VALIDATION: JsonValidationState = {
  parseError: null,
  schemaErrors: [],
  applyError: null
};

function validateJsonText(artifact: JsonArtifactKey, text: string): JsonValidationState {
  const parsed = parseJsonDocument(text);
  if (!parsed.ok) {
    return {
      parseError: parsed.error,
      schemaErrors: [],
      applyError: null
    };
  }

  const validator = validators[artifact];
  const valid = validator(parsed.value);
  if (!valid) {
    return {
      parseError: null,
      schemaErrors: summarizeSchemaErrors(validator.errors),
      applyError: null
    };
  }

  return EMPTY_VALIDATION;
}

function navigateToLine(textarea: HTMLTextAreaElement | null, gutter: HTMLDivElement | null, lineNumber: number): void {
  if (!textarea) {
    return;
  }
  const lines = textarea.value.split('\n');
  const clampedLine = Math.max(0, Math.min(lineNumber - 1, lines.length - 1));
  const charOffset = lines.slice(0, clampedLine).reduce((acc, line) => acc + line.length + 1, 0);
  textarea.focus();
  textarea.setSelectionRange(charOffset, charOffset + lines[clampedLine].length);
  const lineHeight = textarea.scrollHeight / lines.length;
  const scrollTarget = Math.max(0, (clampedLine - 3) * lineHeight);
  textarea.scrollTop = scrollTarget;
  if (gutter) {
    gutter.scrollTop = scrollTarget;
  }
}

function findLineForPath(jsonText: string, instancePath: string): number {
  if (!instancePath || instancePath === '/') {
    return 1;
  }
  const segments = instancePath.split('/').filter(Boolean);
  const lastPropertySegment = [...segments].reverse().find((s) => !/^\d+$/.test(s));
  if (!lastPropertySegment) {
    return 1;
  }
  const lines = jsonText.split('\n');
  const searchPattern = `"${lastPropertySegment}"`;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(searchPattern)) {
      return i + 1;
    }
  }
  return 1;
}

export function JsonEditorPane(props: JsonEditorPaneProps) {
  const state = props.project.value;
  const isOpen = state.uiState.jsonEditorOpen;
  const activeTab = state.uiState.jsonEditorTab;
  const serialized = useMemo(
    () => ({
      definition: formatJson(state.definition),
      component: formatJson(state.component),
      theme: formatJson(state.theme)
    }),
    [state.definition, state.component, state.theme]
  );

  const [drafts, setDrafts] = useState<Record<JsonArtifactKey, string>>(serialized);
  const [baseline, setBaseline] = useState<Record<JsonArtifactKey, string>>(serialized);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const [validation, setValidation] = useState<Record<JsonArtifactKey, JsonValidationState>>({
    definition: EMPTY_VALIDATION,
    component: EMPTY_VALIDATION,
    theme: EMPTY_VALIDATION
  });

  useEffect(() => {
    setDrafts(serialized);
  }, [serialized.definition, serialized.component, serialized.theme]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setBaseline(serialized);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setValidation((current) => ({
      definition: {
        ...validateJsonText('definition', serialized.definition),
        applyError: null
      },
      component: {
        ...validateJsonText('component', serialized.component),
        applyError: null
      },
      theme: {
        ...validateJsonText('theme', serialized.theme),
        applyError: null
      }
    }));
  }, [isOpen, serialized.definition, serialized.component, serialized.theme]);

  if (!isOpen) {
    return null;
  }

  const applyDraft = (artifact: JsonArtifactKey, text: string) => {
    setDrafts((current) => ({
      ...current,
      [artifact]: text
    }));

    const validationState = validateJsonText(artifact, text);
    if (validationState.parseError || validationState.schemaErrors.length > 0) {
      setValidation((current) => ({
        ...current,
        [artifact]: validationState
      }));
      return;
    }

    const parsed = parseJsonDocument(text);
    if (!parsed.ok) {
      return;
    }

    try {
      setJsonDocument(props.project, artifact, parsed.value);
      setValidation((current) => ({
        ...current,
        [artifact]: EMPTY_VALIDATION
      }));
    } catch (error) {
      setValidation((current) => ({
        ...current,
        [artifact]: {
          parseError: null,
          schemaErrors: [],
          applyError: error instanceof Error ? error.message : String(error)
        }
      }));
    }
  };

  const activeValidation = validation[activeTab];

  return (
    <section class="json-editor-pane surface-card" data-testid="json-editor-pane">
      <header class="json-editor-pane__header">
        <div class="json-editor-pane__tabs" role="tablist" aria-label="JSON artifact tabs">
          {(Object.keys(TAB_LABELS) as JsonArtifactKey[]).map((artifact) => (
            <button
              key={artifact}
              type="button"
              role="tab"
              aria-selected={activeTab === artifact}
              class={`json-editor-pane__tab${activeTab === artifact ? ' is-active' : ''}`}
              data-testid={`json-editor-tab-${artifact}`}
              onClick={() => {
                setJsonEditorTab(props.project, artifact);
              }}
            >
              {TAB_LABELS[artifact]}
            </button>
          ))}
        </div>

        <div class="json-editor-pane__actions">
          <button
            type="button"
            class="json-editor-pane__action"
            data-testid="json-editor-format"
            onClick={() => {
              const parsed = parseJsonDocument(drafts[activeTab]);
              if (!parsed.ok) {
                applyDraft(activeTab, drafts[activeTab]);
                return;
              }
              applyDraft(activeTab, formatJson(parsed.value));
            }}
          >
            Format
          </button>
          <button
            type="button"
            class="json-editor-pane__action"
            data-testid="json-editor-close"
            onClick={() => {
              setJsonEditorOpen(props.project, false);
            }}
          >
            Close
          </button>
        </div>
      </header>

      <div class="json-editor-pane__body">
        <div class="json-editor-pane__editor">
          <div
            ref={(el) => { gutterRef.current = el; }}
            class="json-editor-pane__gutter"
            aria-hidden="true"
          >
            {drafts[activeTab].split('\n').map((_, i) => (
              <div key={i} class="json-editor-pane__line-num">{i + 1}</div>
            ))}
          </div>
          <textarea
            ref={(el) => { textareaRef.current = el; }}
            class="json-editor-pane__textarea"
            data-testid="json-editor-textarea"
            spellCheck={false}
            value={drafts[activeTab]}
            onInput={(event) => {
              applyDraft(activeTab, (event.currentTarget as HTMLTextAreaElement).value);
            }}
            onScroll={(event) => {
              if (gutterRef.current) {
                gutterRef.current.scrollTop = (event.currentTarget as HTMLTextAreaElement).scrollTop;
              }
            }}
          />
        </div>

        <aside class="json-editor-pane__meta">
          <div class="json-editor-pane__validation" data-testid="json-editor-validation">
            {activeValidation.parseError ? (
              <p class="json-editor-pane__error" data-testid="json-editor-parse-error">
                Parse error: {activeValidation.parseError}
              </p>
            ) : null}

            {!activeValidation.parseError && activeValidation.schemaErrors.length > 0 ? (
              <ul class="json-editor-pane__schema-errors" data-testid="json-editor-schema-errors">
                {activeValidation.schemaErrors.map((error, i) => (
                  <li key={i}>
                    {error.instancePath ? (
                      <button
                        type="button"
                        class="json-editor-pane__error-link"
                        title="Click to navigate to this line"
                        onClick={() => {
                          const lineNumber = findLineForPath(drafts[activeTab], error.instancePath);
                          navigateToLine(textareaRef.current, gutterRef.current, lineNumber);
                        }}
                      >
                        {error.message}
                      </button>
                    ) : (
                      error.message
                    )}
                  </li>
                ))}
              </ul>
            ) : null}

            {!activeValidation.parseError && activeValidation.schemaErrors.length === 0 && activeValidation.applyError ? (
              <p class="json-editor-pane__error" data-testid="json-editor-apply-error">
                {activeValidation.applyError}
              </p>
            ) : null}

            {!activeValidation.parseError &&
            activeValidation.schemaErrors.length === 0 &&
            !activeValidation.applyError ? (
              <p class="json-editor-pane__valid" data-testid="json-editor-valid-state">
                Synced to visual editor.
              </p>
            ) : null}
          </div>

          <pre
            class="json-editor-pane__highlight"
            data-testid="json-editor-highlight"
            dangerouslySetInnerHTML={{
              __html: highlightJson(drafts[activeTab])
            }}
          />
        </aside>
      </div>

      <JsonDiffView baseline={baseline} current={serialized} />
    </section>
  );
}

function parseJsonDocument(value: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) {
      return {
        ok: false,
        error: 'Root value must be a JSON object.'
      };
    }
    return {
      ok: true,
      value: parsed
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function summarizeSchemaErrors(errors: ErrorObject[] | null | undefined): SchemaError[] {
  if (!errors?.length) {
    return [{ message: 'Schema validation failed.', instancePath: '' }];
  }

  return errors.slice(0, 12).map((error) => {
    const path = error.instancePath || '/';
    return {
      message: `${path}: ${error.message ?? 'schema error'}`,
      instancePath: error.instancePath ?? ''
    };
  });
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function highlightJson(value: string): string {
  const escaped = escapeHtml(value);
  return escaped.replace(
    /"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (token, keySuffix) => {
      if (keySuffix) {
        return `<span class="json-token json-token--key">${token.slice(0, -1)}</span>:`;
      }
      if (token === 'true' || token === 'false' || token === 'null') {
        return `<span class="json-token json-token--literal">${token}</span>`;
      }
      if (/^-?\d/.test(token)) {
        return `<span class="json-token json-token--number">${token}</span>`;
      }
      return `<span class="json-token json-token--string">${token}</span>`;
    }
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
