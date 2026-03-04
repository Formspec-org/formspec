import { signal } from '@preact/signals';
import { Topbar } from './components/topbar';
import { TreeEditor } from './components/canvas/tree-editor';
import { Preview } from './components/preview';
import { InspectorPanel } from './components/inspector/inspector-panel';
import { CommandBar } from './components/command-bar';
import { ToastContainer } from './components/toast';
import { editorMode } from './state/project';
import { definition, definitionVersion, setDefinition } from './state/definition';
import { FORM_TEMPLATES } from './logic/seed-definition';
import './state/definition'; // ensure engine is bootstrapped

const inspectorCollapsed = signal(false);

/** Starts true — shows the template picker on first load */
export const showTemplatePicker = signal(true);

export function App() {
    const showPicker = showTemplatePicker.value;

    return (
        <div class="studio-root">
            <Topbar />
            <div class="studio-workspace">
                {/* Canvas (Tree) Panel */}
                <div class="canvas-panel">
                    <div class="canvas-header">
                        <span class="canvas-header-title">Structure</span>
                        <div class="mode-tabs">
                            <button
                                class={`mode-tab${editorMode.value === 'guided' ? ' active' : ''}`}
                                onClick={() => { editorMode.value = 'guided'; }}
                            >
                                Tree
                            </button>
                            <button
                                class={`mode-tab${editorMode.value === 'json' ? ' active' : ''}`}
                                onClick={() => { editorMode.value = 'json'; }}
                            >
                                JSON
                            </button>
                        </div>
                    </div>
                    {editorMode.value === 'guided' ? (
                        <TreeEditor />
                    ) : (
                        <JsonEditor />
                    )}
                </div>

                {/* Preview Panel — or Template Picker on first launch */}
                {showPicker ? (
                    <EmptyState onTemplateSelect={(def) => {
                        setDefinition(def);
                        showTemplatePicker.value = false;
                    }} />
                ) : (
                    <Preview />
                )}

                {/* Inspector Panel */}
                {!showPicker && (
                    <InspectorPanel
                        collapsed={inspectorCollapsed.value}
                        onToggle={() => { inspectorCollapsed.value = !inspectorCollapsed.value; }}
                    />
                )}
            </div>
            <CommandBar />
            <ToastContainer />
        </div>
    );
}

/* ── Inline JSON Editor ─────────────────────────────────────── */

function JsonEditor() {
    const def = definition.value;
    let json: string;
    try {
        json = JSON.stringify(def, null, 2);
    } catch {
        json = '{}';
    }

    return (
        <div class="json-editor">
            <textarea
                class="json-editor-textarea"
                value={json}
                onInput={(e) => {
                    try {
                        const parsed = JSON.parse((e.target as HTMLTextAreaElement).value);
                        if (parsed.$formspec) {
                            setDefinition(parsed);
                        }
                    } catch {
                        // ignore parse errors while typing
                    }
                }}
                spellcheck={false}
            />
        </div>
    );
}

/* ── Empty State with Template Picker ───────────────────────── */

function EmptyState({ onTemplateSelect }: { onTemplateSelect: (def: any) => void }) {
    return (
        <div class="preview-panel">
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                </div>
                <h1 class="empty-state-title">Build Your Form</h1>
                <p class="empty-state-description">
                    Choose a template to get started, or begin with a blank canvas.
                    Use the tree panel to add fields, groups, and layout components.
                </p>
                <div class="empty-state-actions">
                    {FORM_TEMPLATES.map((tmpl) => (
                        <div
                            key={tmpl.id}
                            class="template-card"
                            onClick={() => onTemplateSelect(tmpl.factory())}
                            role="button"
                            tabIndex={0}
                        >
                            <span class="template-card-icon">{tmpl.icon}</span>
                            <span class="template-card-label">{tmpl.label}</span>
                            <span class="template-card-desc">{tmpl.desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
