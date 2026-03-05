import { useLayoutEffect, useMemo, useState } from 'preact/hooks';
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
  toggleStructurePanel
} from '../state/mutations';

export function Shell() {
  const project = projectSignal.value;
  const diagnostics = derivedSignals.diagnostics.value;
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const commands = useMemo(() => buildStudioCommands(projectSignal), [project]);

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

      if (event.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div class="studio-shell">
      <Toolbar
        formTitle={project.definition.title ?? 'Untitled Form'}
        structurePanelOpen={project.uiState.structurePanelOpen}
        mobilePanel={project.uiState.mobilePanel}
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
          setMobilePanel(projectSignal, 'inspector');
        }}
        onOpenBrand={() => {
          setSelection(projectSignal, null);
          if (projectSignal.value.uiState.mobilePanel !== 'inspector') {
            setMobilePanel(projectSignal, 'inspector');
          }
          setInspectorSectionOpen(projectSignal, 'form:brand-style', true);
        }}
        onOpenFormRules={() => {
          setSelection(projectSignal, null);
          if (projectSignal.value.uiState.mobilePanel !== 'inspector') {
            setMobilePanel(projectSignal, 'inspector');
          }
          setInspectorSectionOpen(projectSignal, 'form:rules', true);
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
              project={project}
              previewWidth={project.uiState.previewWidth}
              activeBreakpoint={project.uiState.activeBreakpoint}
            />
          ) : null}

          <JsonEditorPane project={projectSignal} />
        </main>

        {project.selection || project.uiState.mobilePanel === 'inspector' ? (
          <aside class="shell-panel shell-panel--right" data-testid="inspector-panel">
            <div class="shell-panel__header">Inspector</div>
            <Inspector project={projectSignal} />
          </aside>
        ) : null}
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
    </div>
  );
}
