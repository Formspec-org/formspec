import type { ComponentChildren } from 'preact';
import { BreakpointBar } from './responsive/BreakpointBar';

export interface ToolbarProps {
  formTitle: string;
  structurePanelOpen: boolean;
  mobilePanel: 'none' | 'structure' | 'inspector';
  viewMode: 'edit' | 'preview' | 'split';
  previewWidth: number;
  activeBreakpoint: string;
  breakpoints: Record<string, number>;
  onTitleInput: (value: string) => void;
  onToggleStructure: () => void;
  onToggleInspector: () => void;
  onOpenBrand: () => void;
  onOpenFormRules: () => void;
  onTogglePreview: () => void;
  onPreviewWidthInput: (value: number) => void;
  onActiveBreakpointInput: (value: string) => void;
  onBreakpointWidthInput: (breakpointName: string, width: number) => void;
}

function ToolbarButton(props: { active?: boolean; onClick: () => void; children: ComponentChildren; testId: string }) {
  return (
    <button
      type="button"
      class={`toolbar-button${props.active ? ' is-active' : ''}`}
      onClick={props.onClick}
      data-testid={props.testId}
    >
      {props.children}
    </button>
  );
}

export function Toolbar(props: ToolbarProps) {
  return (
    <header class="toolbar" data-testid="toolbar">
      <div class="toolbar__top">
        <div class="toolbar__brand">
          <label class="sr-only" for="form-title-input">
            Form title
          </label>
          <input
            id="form-title-input"
            data-testid="form-title-input"
            class="toolbar__title-input"
            type="text"
            value={props.formTitle}
            onInput={(event) => {
              props.onTitleInput((event.currentTarget as HTMLInputElement).value);
            }}
            placeholder="Untitled Form"
          />
        </div>

        <div class="toolbar__actions">
          <ToolbarButton
            testId="toggle-structure"
            active={props.structurePanelOpen || props.mobilePanel === 'structure'}
            onClick={props.onToggleStructure}
          >
            Structure
          </ToolbarButton>

          <ToolbarButton
            testId="toggle-inspector"
            active={props.mobilePanel === 'inspector'}
            onClick={props.onToggleInspector}
          >
            Inspector
          </ToolbarButton>

          <ToolbarButton testId="open-brand-panel" onClick={props.onOpenBrand}>
            Brand
          </ToolbarButton>

          <ToolbarButton testId="open-form-rules" onClick={props.onOpenFormRules}>
            Form Rules
          </ToolbarButton>

          <ToolbarButton testId="toggle-preview" active={props.viewMode !== 'edit'} onClick={props.onTogglePreview}>
            Preview
          </ToolbarButton>
        </div>
      </div>

      {props.viewMode !== 'edit' ? (
        <BreakpointBar
          previewWidth={props.previewWidth}
          activeBreakpoint={props.activeBreakpoint}
          breakpoints={props.breakpoints}
          onPreviewWidthInput={props.onPreviewWidthInput}
          onActiveBreakpointInput={props.onActiveBreakpointInput}
          onBreakpointWidthInput={props.onBreakpointWidthInput}
        />
      ) : null}
    </header>
  );
}
