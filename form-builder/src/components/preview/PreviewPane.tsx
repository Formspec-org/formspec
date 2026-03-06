import type { Signal } from '@preact/signals';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { ProjectState } from '../../state/project';
import { FormspecRender } from 'formspec-webcomponent';

if (!customElements.get('formspec-render')) {
  customElements.define('formspec-render', FormspecRender);
}

const DEVICE_PRESETS = [
  { label: 'Mobile', width: 375, icon: '📱' },
  { label: 'Tablet', width: 768, icon: '📟' },
  { label: 'Desktop', width: 1280, icon: '🖥' }
] as const;

export interface PreviewPaneProps {
  project: Signal<ProjectState>;
  previewWidth: number;
  activeBreakpoint: string;
  onWidthChange?: (width: number) => void;
}

interface FormspecRenderElement extends HTMLElement {
  definition: unknown;
  componentDocument: unknown;
  themeDocument: unknown;
  touchAllFields?: () => void;
}

export function PreviewPane(props: PreviewPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<FormspecRenderElement | null>(null);
  const [showingErrors, setShowingErrors] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const el = document.createElement('formspec-render') as FormspecRenderElement;
    el.setAttribute('data-testid', 'preview-renderer');
    containerRef.current.appendChild(el);
    rendererRef.current = el;

    return () => {
      el.remove();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const dispose = props.project.subscribe((state: ProjectState) => {
      const el = rendererRef.current;
      if (!el) return;

      el.definition = structuredClone(state.definition);
      el.componentDocument = structuredClone(state.component);
      el.themeDocument = structuredClone(state.theme);
      setShowingErrors(false);
    });

    return dispose;
  }, [props.project]);

  const sendTouchAll = useCallback(() => {
    rendererRef.current?.touchAllFields?.();
  }, []);

  return (
    <section class="preview-pane surface-card" data-testid="preview-pane">
      <header class="preview-pane__header">
        <p>Live preview</p>
        <div class="preview-pane__header-actions">
          <div class="preview-pane__device-presets" role="group" aria-label="Device presets">
            {DEVICE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                class={`preview-pane__device-btn${props.previewWidth === preset.width ? ' is-active' : ''}`}
                title={`${preset.label} (${preset.width}px)`}
                aria-pressed={props.previewWidth === preset.width}
                onClick={() => props.onWidthChange?.(preset.width)}
              >
                <span class="preview-pane__device-icon" aria-hidden="true">{preset.icon}</span>
                <span class="preview-pane__device-label">{preset.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            class={`preview-pane__errors-btn${showingErrors ? ' is-active' : ''}`}
            data-testid="preview-show-errors"
            title="Touch all fields to reveal validation errors"
            onClick={() => {
              sendTouchAll();
              setShowingErrors(true);
            }}
          >
            Show errors
          </button>
          <span class="preview-pane__size" data-testid="preview-size-label">
            {props.activeBreakpoint} · {props.previewWidth}px
          </span>
        </div>
      </header>
      <div class="preview-pane__viewport">
        <div
          ref={containerRef}
          class="preview-pane__canvas"
          data-testid="preview-canvas"
          style={{ width: `${props.previewWidth}px` }}
        />
      </div>
    </section>
  );
}
