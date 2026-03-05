// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from '../../App';
import { createInitialDefinition, createInitialProjectState, projectSignal } from '../../state/project';
import { moveItem, setFormTitle, setJsonEditorOpen } from '../../state/mutations';
import { PREVIEW_MESSAGE_CHANNEL } from '../preview/messages';

function mountApp() {
  const host = document.createElement('div');
  document.body.append(host);
  render(<App />, host);
  return host;
}

function pressCommandPaletteShortcut() {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      bubbles: true
    })
  );
}

function pressStructureShortcut() {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: '\\',
      code: 'Backslash',
      ctrlKey: true,
      bubbles: true
    })
  );
}

function pressJsonEditorShortcut() {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'J',
      code: 'KeyJ',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true
    })
  );
}

describe('studio shell layout', () => {
  beforeEach(() => {
    projectSignal.value = createInitialProjectState();
    document.body.innerHTML = '';
  });

  it('renders toolbar, center surface, and diagnostics bar', () => {
    const host = mountApp();

    expect(host.querySelector('[data-testid="toolbar"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="form-surface-panel"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="diagnostics-bar"]')).not.toBeNull();
  });

  it('keeps structure panel collapsed by default and toggles from toolbar', async () => {
    const host = mountApp();

    expect(host.querySelector('[data-testid="structure-panel"]')).toBeNull();

    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="toggle-structure"]');
    expect(toggle).not.toBeNull();
    await act(async () => {
      toggle?.click();
    });

    expect(host.querySelector('[data-testid="structure-panel"]')).not.toBeNull();
  });

  it('toggles the structure panel from Cmd/Ctrl+\\ shortcut', async () => {
    const host = mountApp();
    expect(host.querySelector('[data-testid="structure-panel"]')).toBeNull();

    await act(async () => {
      pressStructureShortcut();
    });
    expect(host.querySelector('[data-testid="structure-panel"]')).not.toBeNull();

    await act(async () => {
      pressStructureShortcut();
    });
    expect(host.querySelector('[data-testid="structure-panel"]')).toBeNull();
  });

  it('renders structure hierarchy and syncs selection from tree clicks', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        items: [
          { type: 'field', key: 'applicantName', label: 'Applicant Name', dataType: 'string' },
          {
            type: 'group',
            key: 'address',
            label: 'Address',
            children: [{ type: 'field', key: 'city', label: 'City', dataType: 'string' }]
          }
        ],
        binds: [{ path: 'applicantName', required: true }]
      })
    });

    const host = mountApp();
    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="toggle-structure"]');
    expect(toggle).not.toBeNull();
    await act(async () => {
      toggle?.click();
    });

    expect(host.querySelector('[data-testid="structure-node-applicantName"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="structure-logic-badge-applicantName-required"]')).not.toBeNull();
    const childNode = host.querySelector<HTMLElement>('[data-testid="structure-node-address.city"]');
    expect(childNode).not.toBeNull();
    if (!childNode) {
      return;
    }

    await act(async () => {
      childNode.click();
    });

    expect(projectSignal.value.selection).toBe('address.city');
    expect(childNode.className).toContain('is-selected');
    expect(host.querySelector('[data-testid="field-inspector"]')).not.toBeNull();
  });

  it('renders draggable tree nodes and drop targets for reordering', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        items: [
          { type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' },
          { type: 'field', key: 'lastName', label: 'Last Name', dataType: 'string' }
        ]
      })
    });

    const host = mountApp();
    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="toggle-structure"]');
    expect(toggle).not.toBeNull();
    await act(async () => {
      toggle?.click();
    });

    const source = host.querySelector<HTMLElement>('[data-testid="structure-node-firstName"]');
    const destination = host.querySelector<HTMLElement>('[data-testid="structure-dropzone-root-2"]');
    expect(source).not.toBeNull();
    expect(destination).not.toBeNull();
    if (!source) {
      return;
    }

    expect(source.getAttribute('draggable')).toBe('true');
    expect(host.querySelector('[data-testid="structure-dropzone-root-0"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="structure-dropzone-root-1"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="structure-dropzone-root-2"]')).not.toBeNull();
  });

  it('cycles preview modes between split, full preview, and edit', async () => {
    const host = mountApp();
    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="toggle-preview"]');
    expect(toggle).not.toBeNull();
    if (!toggle) {
      return;
    }

    expect(host.querySelector('[data-testid="preview-pane"]')).toBeNull();
    expect(host.querySelector('[data-testid="form-surface-panel"]')).not.toBeNull();

    await act(async () => {
      toggle.click();
    });
    expect(projectSignal.value.uiState.viewMode).toBe('split');
    expect(host.querySelector('[data-testid="preview-pane"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="form-surface-panel"]')).not.toBeNull();

    await act(async () => {
      toggle.click();
    });
    expect(projectSignal.value.uiState.viewMode).toBe('preview');
    expect(host.querySelector('[data-testid="preview-pane"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="form-surface-panel"]')).toBeNull();

    await act(async () => {
      toggle.click();
    });
    expect(projectSignal.value.uiState.viewMode).toBe('edit');
    expect(host.querySelector('[data-testid="preview-pane"]')).toBeNull();
    expect(host.querySelector('[data-testid="form-surface-panel"]')).not.toBeNull();
  });

  it('drives responsive preview width and breakpoint controls from the toolbar', async () => {
    const host = mountApp();

    const widthSlider = host.querySelector<HTMLInputElement>('[data-testid="breakpoint-width-slider"]');
    expect(widthSlider).not.toBeNull();
    if (!widthSlider) {
      return;
    }

    await act(async () => {
      widthSlider.value = '1050';
      widthSlider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(projectSignal.value.uiState.previewWidth).toBe(1050);
    expect(projectSignal.value.uiState.activeBreakpoint).toBe('lg');

    const lgWidthInput = host.querySelector<HTMLInputElement>('[data-testid="breakpoint-width-input"]');
    expect(lgWidthInput).not.toBeNull();
    if (!lgWidthInput) {
      return;
    }

    await act(async () => {
      lgWidthInput.value = '1100';
      lgWidthInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(projectSignal.value.theme.breakpoints?.lg).toBe(1100);
    expect(projectSignal.value.component.breakpoints?.lg).toBe(1100);

    const previewToggle = host.querySelector<HTMLButtonElement>('[data-testid="toggle-preview"]');
    expect(previewToggle).not.toBeNull();
    if (!previewToggle) {
      return;
    }

    await act(async () => {
      previewToggle.click();
    });

    const canvas = host.querySelector<HTMLElement>('[data-testid="preview-canvas"]');
    expect(canvas).not.toBeNull();
    expect(canvas?.style.width).toBe('1050px');

    const mdSnap = host.querySelector<HTMLButtonElement>('[data-testid="breakpoint-snap-md"]');
    expect(mdSnap).not.toBeNull();
    if (!mdSnap) {
      return;
    }

    await act(async () => {
      mdSnap.click();
    });

    expect(projectSignal.value.uiState.previewWidth).toBe(768);
    expect(projectSignal.value.uiState.activeBreakpoint).toBe('md');
  });

  it('syncs preview artifacts after iframe readiness and on later state changes', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        title: 'Initial title',
        items: [{ type: 'field', key: 'organizationName', label: 'Organization Name', dataType: 'string' }]
      })
    });

    const host = mountApp();
    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="toggle-preview"]');
    expect(toggle).not.toBeNull();
    if (!toggle) {
      return;
    }

    await act(async () => {
      toggle.click();
    });

    const iframe = host.querySelector<HTMLIFrameElement>('[data-testid="preview-iframe"]');
    expect(iframe).not.toBeNull();
    if (!iframe) {
      return;
    }

    const postMessage = (event: MessageEvent) => {
      void event;
    };
    const frameWindow = { postMessage } as unknown as Window;
    const postMessageSpy = vi.spyOn(frameWindow, 'postMessage');

    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: frameWindow
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: frameWindow,
          data: {
            channel: PREVIEW_MESSAGE_CHANNEL,
            type: 'ready'
          }
        })
      );
    });

    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    expect(postMessageSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        channel: PREVIEW_MESSAGE_CHANNEL,
        type: 'sync',
        payload: expect.objectContaining({
          definition: expect.objectContaining({
            title: 'Initial title'
          })
        })
      }),
      '*'
    );

    await act(async () => {
      setFormTitle(projectSignal, 'Updated title');
    });

    expect(postMessageSpy).toHaveBeenCalledTimes(2);
    expect(postMessageSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        channel: PREVIEW_MESSAGE_CHANNEL,
        type: 'sync',
        payload: expect.objectContaining({
          definition: expect.objectContaining({
            title: 'Updated title'
          })
        })
      }),
      '*'
    );
  });

  it('shows form inspector by default and item inspector when selected', async () => {
    const host = mountApp();
    expect(host.querySelector('[data-testid="inspector-panel"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="form-inspector"]')).not.toBeNull();

    await act(async () => {
      projectSignal.value = createInitialProjectState({
        definition: createInitialDefinition({
          items: [{ type: 'field', key: 'name', label: 'Name', dataType: 'string' }]
        }),
        selection: 'name'
      });
    });

    expect(host.querySelector('[data-testid="field-inspector"]')).not.toBeNull();
  });

  it('routes display-item selection to display inspector controls', () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        items: [{ type: 'display', key: 'intro', label: 'Introduction' }]
      }),
      selection: 'intro'
    });

    const host = mountApp();
    expect(host.querySelector('[data-testid="display-inspector"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="display-key-input"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="display-label-input"]')).not.toBeNull();
  });

  it('rewrites bind expressions when renaming then moving an item through UI interactions', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        items: [
          { type: 'field', key: 'amount', label: 'Amount', dataType: 'number' },
          {
            type: 'group',
            key: 'details',
            label: 'Details',
            children: [{ type: 'field', key: 'notes', label: 'Notes', dataType: 'string' }]
          },
          { type: 'field', key: 'total', label: 'Total', dataType: 'number' }
        ],
        binds: [{ path: 'total', calculate: '$amount + 1' }]
      })
    });

    const host = mountApp();
    const amountItem = host.querySelector<HTMLElement>('[data-testid="surface-item-amount"]');
    expect(amountItem).not.toBeNull();
    if (!amountItem) {
      return;
    }

    await act(async () => {
      amountItem.click();
    });

    const keyInput = host.querySelector<HTMLInputElement>('[data-testid="field-key-input"]');
    expect(keyInput).not.toBeNull();
    if (!keyInput) {
      return;
    }

    await act(async () => {
      keyInput.value = 'projectAmount';
      keyInput.dispatchEvent(new Event('input', { bubbles: true }));
      keyInput.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    const renamedBind = projectSignal.value.definition.binds?.find((entry) => entry.path === 'total');
    expect(renamedBind?.calculate).toContain('$projectAmount');

    await act(async () => {
      moveItem(projectSignal, 'projectAmount', { parentPath: 'details', index: 0 });
    });

    const detailsGroup = projectSignal.value.definition.items.find((item) => item.key === 'details');
    expect(detailsGroup?.children?.map((item) => item.key)).toEqual([
      'projectAmount',
      'notes'
    ]);
    const movedBind = projectSignal.value.definition.binds?.find((entry) => entry.path === 'total');
    expect(movedBind?.calculate).toContain('details.projectAmount');
    expect(projectSignal.value.selection).toBe('details.projectAmount');
  });

  it('opens brand panel from toolbar by clearing selection', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        items: [{ type: 'field', key: 'name', label: 'Name', dataType: 'string' }]
      }),
      selection: 'name'
    });

    const host = mountApp();
    expect(host.querySelector('[data-testid="field-inspector"]')).not.toBeNull();

    const openBrand = host.querySelector<HTMLButtonElement>('[data-testid="open-brand-panel"]');
    expect(openBrand).not.toBeNull();
    if (!openBrand) {
      return;
    }

    await act(async () => {
      openBrand.click();
    });

    expect(projectSignal.value.selection).toBeNull();
    expect(host.querySelector('[data-testid="form-inspector"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="section-brand-style"]')).not.toBeNull();
  });

  it('opens form rules from toolbar and keeps inspector on form-level rules', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        items: [{ type: 'field', key: 'name', label: 'Name', dataType: 'string' }]
      }),
      selection: 'name'
    });

    const host = mountApp();
    expect(host.querySelector('[data-testid="field-inspector"]')).not.toBeNull();

    const openRules = host.querySelector<HTMLButtonElement>('[data-testid="open-form-rules"]');
    expect(openRules).not.toBeNull();
    if (!openRules) {
      return;
    }

    await act(async () => {
      openRules.click();
    });

    expect(projectSignal.value.selection).toBeNull();
    expect(host.querySelector('[data-testid="form-inspector"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="section-form-rules"]')).not.toBeNull();
  });

  it('updates form title from toolbar input', () => {
    const host = mountApp();
    const input = host.querySelector<HTMLInputElement>('[data-testid="form-title-input"]');

    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    input.value = 'Grant Application';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(projectSignal.value.definition.title).toBe('Grant Application');
  });

  it('expands diagnostics details when toggled', async () => {
    const host = mountApp();

    expect(host.querySelector('[data-testid="diagnostics-panel"]')).toBeNull();

    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="toggle-diagnostics"]');
    expect(toggle).not.toBeNull();
    await act(async () => {
      toggle?.click();
    });

    expect(host.querySelector('[data-testid="diagnostics-panel"]')).not.toBeNull();
  });

  it('combines Ajv and FormEngine diagnostics in the expanded panel', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        version: 1 as unknown as string,
        items: [{ type: 'field', key: 'applicantName', label: 'Applicant Name', dataType: 'string' }],
        binds: [{ path: 'applicantName', required: true }]
      })
    });

    const host = mountApp();
    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="toggle-diagnostics"]');
    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle?.click();
    });

    expect(host.querySelector('[data-testid="diagnostics-section-ajv"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="diagnostics-section-engine"]')).not.toBeNull();
  });

  it('navigates to a field when clicking an engine diagnostic entry', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        items: [{ type: 'field', key: 'organizationName', label: 'Organization Name', dataType: 'string' }],
        binds: [{ path: 'organizationName', required: true }]
      })
    });

    const host = mountApp();
    const toggle = host.querySelector<HTMLButtonElement>('[data-testid="toggle-diagnostics"]');
    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle?.click();
    });

    const entryButton = host.querySelector<HTMLButtonElement>('[data-testid="diagnostics-entry-button"]');
    expect(entryButton).not.toBeNull();
    if (!entryButton) {
      return;
    }

    await act(async () => {
      entryButton.click();
    });

    expect(projectSignal.value.selection).toBe('organizationName');
    expect(host.querySelector('[data-testid="field-inspector"]')).not.toBeNull();
  });

  it('opens command palette from keyboard shortcut and closes on escape', async () => {
    const host = mountApp();
    expect(host.querySelector('[data-testid="command-palette"]')).toBeNull();

    await act(async () => {
      pressCommandPaletteShortcut();
    });

    expect(host.querySelector('[data-testid="command-palette"]')).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true
        })
      );
    });

    expect(host.querySelector('[data-testid="command-palette"]')).toBeNull();
  });

  it('opens JSON editor from Ctrl/Cmd+Shift+J shortcut', async () => {
    const host = mountApp();
    expect(host.querySelector('[data-testid="json-editor-pane"]')).toBeNull();

    await act(async () => {
      pressJsonEditorShortcut();
    });

    expect(projectSignal.value.uiState.jsonEditorOpen).toBe(true);
    expect(host.querySelector('[data-testid="json-editor-pane"]')).not.toBeNull();
  });

  it('filters command palette results and executes selected command with enter', async () => {
    const host = mountApp();
    expect(host.querySelector('[data-testid="structure-panel"]')).toBeNull();

    await act(async () => {
      pressCommandPaletteShortcut();
    });

    const input = host.querySelector<HTMLInputElement>('[data-testid="command-palette-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = 'toggle structure';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="command-result-action-toggle-structure"]')).not.toBeNull();

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true
        })
      );
    });

    expect(projectSignal.value.uiState.structurePanelOpen).toBe(true);
    expect(host.querySelector('[data-testid="command-palette"]')).toBeNull();
  });

  it('opens JSON editor from command palette', async () => {
    const host = mountApp();
    expect(host.querySelector('[data-testid="json-editor-pane"]')).toBeNull();

    await act(async () => {
      pressCommandPaletteShortcut();
    });

    const input = host.querySelector<HTMLInputElement>('[data-testid="command-palette-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = 'json editor';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="command-result-advanced-json-editor"]')).not.toBeNull();

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true
        })
      );
    });

    expect(projectSignal.value.uiState.jsonEditorOpen).toBe(true);
    expect(host.querySelector('[data-testid="json-editor-pane"]')).not.toBeNull();
  });

  it('opens version management section from command palette', async () => {
    const host = mountApp();

    await act(async () => {
      pressCommandPaletteShortcut();
    });

    const input = host.querySelector<HTMLInputElement>('[data-testid="command-palette-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = 'version management';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="command-result-action-version-management"]')).not.toBeNull();

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true
        })
      );
    });

    expect(projectSignal.value.selection).toBeNull();
    expect(projectSignal.value.uiState.inspectorSections['form:version']).toBe(true);
    expect(host.querySelector('[data-testid="command-palette"]')).toBeNull();
  });

  it('opens import/export section from command palette', async () => {
    const host = mountApp();

    await act(async () => {
      pressCommandPaletteShortcut();
    });

    const input = host.querySelector<HTMLInputElement>('[data-testid="command-palette-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = 'import export';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="command-result-action-import-export"]')).not.toBeNull();

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true
        })
      );
    });

    expect(projectSignal.value.selection).toBeNull();
    expect(projectSignal.value.uiState.inspectorSections['form:import-export']).toBe(true);
    expect(host.querySelector('[data-testid="command-palette"]')).toBeNull();
  });

  it('fuzzy-matches field labels and navigates selection with enter', async () => {
    projectSignal.value = createInitialProjectState({
      definition: createInitialDefinition({
        items: [
          { type: 'field', key: 'organizationName', label: 'Organization Name', dataType: 'string' },
          { type: 'field', key: 'organizationType', label: 'Organization Type', dataType: 'choice' }
        ]
      })
    });

    const host = mountApp();

    await act(async () => {
      pressCommandPaletteShortcut();
    });

    const input = host.querySelector<HTMLInputElement>('[data-testid="command-palette-input"]');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }

    await act(async () => {
      input.value = 'org nm';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="command-result-nav-field-organizationName"]')).not.toBeNull();

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true
        })
      );
    });

    expect(projectSignal.value.selection).toBe('organizationName');
  });

  it('syncs definition JSON edits to visual state and reports parse errors', async () => {
    const host = mountApp();

    await act(async () => {
      setJsonEditorOpen(projectSignal, true, 'definition');
    });

    const textarea = host.querySelector<HTMLTextAreaElement>('[data-testid="json-editor-textarea"]');
    expect(textarea).not.toBeNull();
    if (!textarea) {
      return;
    }

    const nextDefinition = {
      ...projectSignal.value.definition,
      title: 'JSON Updated Title'
    };

    await act(async () => {
      textarea.value = JSON.stringify(nextDefinition, null, 2);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(projectSignal.value.definition.title).toBe('JSON Updated Title');
    expect(host.querySelector('[data-testid="json-editor-parse-error"]')).toBeNull();

    await act(async () => {
      setFormTitle(projectSignal, 'Toolbar Updated Title');
    });

    expect(textarea.value).toContain('"title": "Toolbar Updated Title"');

    await act(async () => {
      textarea.value = '{"broken": ';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="json-editor-parse-error"]')).not.toBeNull();
    expect(projectSignal.value.definition.title).toBe('Toolbar Updated Title');
  });
});
