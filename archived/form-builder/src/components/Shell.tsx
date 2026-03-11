import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CommandPalette } from './CommandPalette';
import { DiagnosticsBar } from './DiagnosticsBar';
import { Inspector } from './inspector/Inspector';
import { JsonEditorPane } from './json/JsonEditorPane';
import { Toolbar } from './Toolbar';
import { PreviewPane } from './preview/PreviewPane';
import { FormSurface } from './surface/FormSurface';
import { StructurePanel } from './tree/StructurePanel';
import { buildStudioCommands } from './commands';
import { derivedSignals } from '../state/derived';
import { projectSignal } from '../state/project';
import { findItemByPath } from './inspector/utils';
import {
  setActiveBreakpoint,
  setPreviewWidth,
  setInspectorSectionOpen,
  setSelection,
  setFormTitle,
  setMobilePanel,
  setThemeBreakpoint,
  toggleDiagnosticsOpen,
  toggleJsonEditor,
  togglePreviewMode,
  toggleStructurePanel,
  undoProject,
  redoProject,
  deleteItem,
  duplicateItem
} from '../state/mutations';

export function Shell() {
  const project = projectSignal.value;
  const diagnostics = derivedSignals.diagnostics.value;
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const commands = useMemo(() => buildStudioCommands(projectSignal), [project]);
  const ariaLiveRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const rawKey = event.key ?? '';
      const normalizedKey = rawKey.toLowerCase();
      const isPaletteShortcutKey =
        normalizedKey === 'k' || event.code === 'KeyK' || event.keyCode === 75 || event.which === 75;
      if ((event.metaKey || event.ctrlKey) && isPaletteShortcutKey) {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      const isStructureShortcutKey = normalizedKey === '\\' || event.code === 'Backslash';
      if ((event.metaKey || event.ctrlKey) && isStructureShortcutKey) {
        event.preventDefault();
        toggleStructurePanel(projectSignal);
        return;
      }

      const isJsonShortcutKey =
        normalizedKey === 'j' || event.code === 'KeyJ' || event.keyCode === 74 || event.which === 74;
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && isJsonShortcutKey) {
        event.preventDefault();
        toggleJsonEditor(projectSignal, 'definition');
        return;
      }

      const isPreviewShortcutKey =
        normalizedKey === 'p' || event.code === 'KeyP' || event.keyCode === 80 || event.which === 80;
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && isPreviewShortcutKey) {
        event.preventDefault();
        togglePreviewMode(projectSignal);
        return;
      }

      const isUndoKey = normalizedKey === 'z' || event.code === 'KeyZ' || event.keyCode === 90 || event.which === 90;
      if ((event.metaKey || event.ctrlKey) && isUndoKey && !event.shiftKey) {
        event.preventDefault();
        undoProject(projectSignal);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && isUndoKey && event.shiftKey) {
        event.preventDefault();
        redoProject(projectSignal);
        return;
      }

      if (event.key === 'Escape') {
        setCommandPaletteOpen(false);
        return;
      }

      const isDuplicateKey =
        normalizedKey === 'd' || event.code === 'KeyD' || event.keyCode === 68 || event.which === 68;
      if ((event.metaKey || event.ctrlKey) && isDuplicateKey && !event.shiftKey) {
        const sel = projectSignal.value.selection;
        if (sel && !isInputFocused()) {
          event.preventDefault();
          duplicateItem(projectSignal, sel);
        }
        return;
      }

      const isDeleteKey = event.key === 'Backspace' || event.key === 'Delete';
      if (isDeleteKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        const sel = projectSignal.value.selection;
        if (sel && !isInputFocused()) {
          event.preventDefault();
          deleteItem(projectSignal, sel);
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const selectedLabel = project.selection
    ? resolveFieldLabel(project.definition.items, project.selection)
    : null;

  return (
    <div class="studio-shell">
      <Toolbar
        formTitle={project.definition.title ?? 'Untitled Form'}
        structurePanelOpen={project.uiState.structurePanelOpen}
        mobilePanel={project.uiState.mobilePanel}
        inspectorVisible={!!project.selection || project.uiState.mobilePanel === 'inspector'}
        viewMode={project.uiState.viewMode}
        previewWidth={project.uiState.previewWidth}
        activeBreakpoint={project.uiState.activeBreakpoint}
        breakpoints={project.theme.breakpoints ?? {}}
        onTitleInput={(value) => {
          if ((projectSignal.value.definition.title ?? '') === value) {
            return;
          }
          setFormTitle(projectSignal, value);
        }}
        onToggleStructure={() => {
          toggleStructurePanel(projectSignal);
        }}
        onToggleInspector={() => {
          const state = projectSignal.value;
          if (state.selection) {
            // Field selected: deselect to show form-level inspector
            setSelection(projectSignal, null);
            if (state.uiState.mobilePanel !== 'inspector') {
              setMobilePanel(projectSignal, 'inspector');
            }
          } else {
            // No selection: toggle the inspector panel on/off
            setMobilePanel(projectSignal, 'inspector');
          }
        }}
        onTogglePreview={() => {
          togglePreviewMode(projectSignal);
        }}
        onPreviewWidthInput={(value) => {
          setPreviewWidth(projectSignal, value);
        }}
        onActiveBreakpointInput={(value) => {
          setActiveBreakpoint(projectSignal, value);
        }}
        onBreakpointWidthInput={(breakpointName, width) => {
          setThemeBreakpoint(projectSignal, breakpointName, width);
        }}
      />

      <div
        class="shell-grid"
        data-mobile-panel={project.uiState.mobilePanel}
        data-structure-open={project.uiState.structurePanelOpen ? 'true' : 'false'}
        data-inspector-hidden={!project.selection && project.uiState.mobilePanel !== 'inspector' ? 'true' : 'false'}
      >
        {project.uiState.structurePanelOpen ? (
          <aside class="shell-panel shell-panel--left" data-testid="structure-panel">
            <div class="shell-panel__header">Structure</div>
            <StructurePanel project={projectSignal} />
          </aside>
        ) : null}

        <main
          class="shell-workspace"
          data-view-mode={project.uiState.viewMode}
          data-json-open={project.uiState.jsonEditorOpen ? 'true' : 'false'}
          data-testid="shell-workspace"
        >
          {project.uiState.viewMode !== 'preview' ? (
            <section class="shell-surface" data-testid="form-surface-panel">
              <FormSurface project={projectSignal} />
            </section>
          ) : null}

          {project.uiState.viewMode !== 'edit' ? (
            <PreviewPane
              project={projectSignal}
              previewWidth={project.uiState.previewWidth}
              activeBreakpoint={project.uiState.activeBreakpoint}
              onWidthChange={(width) => setPreviewWidth(projectSignal, width)}
            />
          ) : null}

          <JsonEditorPane project={projectSignal} />
        </main>

        <aside class="shell-panel shell-panel--right" data-testid="inspector-panel">
          <div class={`shell-panel__header${project.selection ? ' shell-panel__header--item' : ''}`}>
            {resolveInspectorHeader(project.definition.items, project.selection)}
          </div>
          <Inspector project={projectSignal} />
        </aside>
      </div>

      <DiagnosticsBar
        diagnostics={diagnostics}
        expanded={project.uiState.diagnosticsOpen}
        onToggleExpanded={() => {
          toggleDiagnosticsOpen(projectSignal);
        }}
        onNavigate={(entry) => {
          if (!entry.navigation) {
            return;
          }

          setSelection(projectSignal, entry.navigation.selectionPath);

          if (entry.navigation.inspectorSection) {
            setInspectorSectionOpen(projectSignal, entry.navigation.inspectorSection, true);
          }
        }}
      />

      <CommandPalette
        open={commandPaletteOpen}
        commands={commands}
        onClose={() => {
          setCommandPaletteOpen(false);
        }}
      />

      <div
        ref={(el) => {
          ariaLiveRef.current = el;
        }}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
        data-testid="aria-live-region"
      >
        {selectedLabel ? `Selected: ${selectedLabel}` : ''}
      </div>
    </div>
  );
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) {
    return false;
  }
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
}

function resolveFieldLabel(
  items: import('formspec-engine').FormspecItem[],
  path: string
): string | null {
  const segments = path.replace(/\[\*?\d*\]/g, '').split('.');
  let current = items;
  let label: string | null = null;
  for (const segment of segments) {
    const found = current.find((item) => item.key === segment);
    if (!found) {
      return null;
    }
    label = ('label' in found && typeof (found as Record<string, unknown>).label === 'string'
      ? (found as Record<string, unknown>).label
      : found.key) as string;
    if ('children' in found && Array.isArray((found as Record<string, unknown>).children)) {
      current = (found as Record<string, unknown>).children as import('formspec-engine').FormspecItem[];
    }
  }
  return label;
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  field: 'Field',
  group: 'Group',
  display: 'Display'
};

function resolveInspectorHeader(
  items: import('formspec-engine').FormspecItem[],
  selection: string | null
): string {
  if (!selection) {
    return 'Form';
  }
  const item = findItemByPath(items, selection);
  if (!item) {
    return 'Inspector';
  }
  const typeLabel = ITEM_TYPE_LABELS[item.type] ?? 'Item';
  const name = item.label || item.key;
  return `${typeLabel}: ${name}`;
}
