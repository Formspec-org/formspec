/** @filedesc Tabbed JSON editor panel for definition, component doc, and theme in the stories app. */
import { useState } from 'preact/hooks';

type EditorTab = 'definition' | 'componentDoc' | 'theme';

interface Props {
    defText: string;
    compText: string;
    themeText: string;
    defError: string | null;
    compError: string | null;
    themeError: string | null;
    onDefChange: (text: string) => void;
    onCompChange: (text: string) => void;
    onThemeChange: (text: string) => void;
}

export function Editor({ defText, compText, themeText, defError, compError, themeError, onDefChange, onCompChange, onThemeChange }: Props) {
    const [tab, setTab] = useState<EditorTab>('definition');

    return (
        <div class="editor-panel">
            <div class="editor-tab-bar">
                <button
                    class={`editor-tab-btn${tab === 'definition' ? ' editor-tab-btn--active' : ''}`}
                    onClick={() => setTab('definition')}
                >
                    Definition{defError ? ' ⚠' : ''}
                </button>
                <button
                    class={`editor-tab-btn${tab === 'componentDoc' ? ' editor-tab-btn--active' : ''}`}
                    onClick={() => setTab('componentDoc')}
                >
                    Component Doc{compError ? ' ⚠' : ''}
                </button>
                <button
                    class={`editor-tab-btn${tab === 'theme' ? ' editor-tab-btn--active' : ''}`}
                    onClick={() => setTab('theme')}
                >
                    Theme{themeError ? ' ⚠' : ''}
                </button>
            </div>

            {tab === 'definition' && (
                <textarea
                    key="def"
                    class={`editor-textarea${defError ? ' editor-textarea--error' : ''}`}
                    spellcheck={false}
                    value={defText}
                    onInput={(e) => onDefChange((e.target as HTMLTextAreaElement).value)}
                />
            )}
            {tab === 'componentDoc' && (
                <textarea
                    key="comp"
                    class={`editor-textarea${compError ? ' editor-textarea--error' : ''}`}
                    spellcheck={false}
                    value={compText}
                    onInput={(e) => onCompChange((e.target as HTMLTextAreaElement).value)}
                />
            )}
            {tab === 'theme' && (
                <textarea
                    key="theme"
                    class={`editor-textarea${themeError ? ' editor-textarea--error' : ''}`}
                    spellcheck={false}
                    value={themeText}
                    onInput={(e) => onThemeChange((e.target as HTMLTextAreaElement).value)}
                />
            )}
        </div>
    );
}
