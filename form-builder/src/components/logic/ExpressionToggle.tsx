import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { FELEditor } from '../controls/FELEditor';
import type { FELEditorFieldOption } from '../controls/fel-utils';

export interface ExpressionToggleRenderArgs<TModel> {
  model: TModel;
  testIdPrefix: string;
  onChange: (next: TModel) => void;
}

export interface ExpressionToggleProps<TModel> {
  label: string;
  value: string | undefined;
  testIdPrefix: string;
  felTestId: string;
  felFieldOptions?: FELEditorFieldOption[];
  onInput: (value: string) => void;
  parse: (expression: string) => TModel | null;
  serialize: (model: TModel) => string;
  createEmpty: () => TModel;
  renderVisual: (args: ExpressionToggleRenderArgs<TModel>) => ComponentChildren;
}

export function ExpressionToggle<TModel>(props: ExpressionToggleProps<TModel>) {
  const [mode, setMode] = useState<'visual' | 'fel'>(() => {
    const parsed = props.parse(props.value ?? '');
    return parsed || !props.value?.trim().length ? 'visual' : 'fel';
  });
  const [model, setModel] = useState<TModel>(() => props.parse(props.value ?? '') ?? props.createEmpty());
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'visual') {
      return;
    }

    const expression = props.value ?? '';
    if (!expression.trim().length) {
      setModel(props.createEmpty());
      return;
    }

    const parsed = props.parse(expression);
    if (parsed) {
      setModel(parsed);
    }
  }, [mode, props.value]);

  const switchToVisual = () => {
    const expression = props.value ?? '';
    if (!expression.trim().length) {
      setModel(props.createEmpty());
      setMode('visual');
      setWarning(null);
      return;
    }

    const parsed = props.parse(expression);
    if (!parsed) {
      setWarning('Expression is too complex for visual builder.');
      return;
    }

    setModel(parsed);
    setMode('visual');
    setWarning(null);
  };

  const switchToFel = () => {
    setMode('fel');
    setWarning(null);
  };

  return (
    <div class="expression-toggle" data-testid={`${props.testIdPrefix}-expression-toggle`}>
      <div class="expression-toggle__header">
        <span class="inspector-control__label">{props.label}</span>
        <div class="expression-toggle__modes">
          <button
            type="button"
            data-testid={`${props.testIdPrefix}-mode-visual`}
            class={`expression-toggle__mode-button ${mode === 'visual' ? 'is-active' : ''}`}
            onClick={switchToVisual}
          >
            Visual
          </button>
          <button
            type="button"
            data-testid={`${props.testIdPrefix}-mode-fel`}
            class={`expression-toggle__mode-button ${mode === 'fel' ? 'is-active' : ''}`}
            onClick={switchToFel}
          >
            FEL
          </button>
        </div>
      </div>

      {warning ? (
        <p class="expression-toggle__warning" data-testid={`${props.testIdPrefix}-too-complex`}>
          {warning}
        </p>
      ) : null}

      {mode === 'visual'
        ? props.renderVisual({
            model,
            testIdPrefix: props.testIdPrefix,
            onChange: (next) => {
              setModel(next);
              props.onInput(props.serialize(next));
            }
          })
        : (
          <FELEditor
            label={props.label}
            value={props.value}
            testId={props.felTestId}
            fieldOptions={props.felFieldOptions}
            onInput={(value) => {
              setWarning(null);
              props.onInput(value);
            }}
          />
          )}
    </div>
  );
}
