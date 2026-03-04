import { useEffect, useRef } from 'preact/hooks';
import { commandBarOpen } from '../state/project';
import { addPickerState } from '../state/selection';
import { setDefinition, definition } from '../state/definition';
import { handleImport, handleExport } from '../logic/import-export';

interface CommandItem {
    icon: string;
    label: string;
    shortcut?: string;
    action: () => void;
}

function getCommands(): CommandItem[] {
    return [
        {
            icon: '➕',
            label: 'Add Component...',
            shortcut: 'A',
            action: () => {
                addPickerState.value = { parentPath: '', insertIndex: Infinity };
            },
        },
        {
            icon: '↓',
            label: 'Import Definition',
            shortcut: '⌘I',
            action: () => handleImport(setDefinition),
        },
        {
            icon: '↑',
            label: 'Export Definition',
            shortcut: '⌘E',
            action: () => handleExport(definition.value),
        },
        {
            icon: '🗑',
            label: 'Clear Form',
            action: () => {
                setDefinition({
                    ...definition.value,
                    items: [],
                });
            },
        },
    ];
}

export function CommandBar() {
    const isOpen = commandBarOpen.value;
    const inputRef = useRef<HTMLInputElement>(null);
    const query = useRef('');

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                commandBarOpen.value = !commandBarOpen.value;
            }
            if (event.key === 'Escape' && commandBarOpen.value) {
                commandBarOpen.value = false;
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const commands = getCommands();

    function executeAndClose(action: () => void) {
        commandBarOpen.value = false;
        action();
    }

    return (
        <div
            class="command-bar-overlay"
            onClick={(event) => {
                if (event.target === event.currentTarget) commandBarOpen.value = false;
            }}
        >
            <div class="command-bar">
                <div class="command-bar-input">
                    <span class="command-bar-icon">⌘</span>
                    <input
                        ref={inputRef}
                        placeholder="Type a command..."
                        onInput={(event) => {
                            query.current = (event.target as HTMLInputElement).value;
                        }}
                    />
                </div>
                <div class="command-bar-results">
                    {commands.map((cmd) => (
                        <div
                            key={cmd.label}
                            class="command-bar-item"
                            onClick={() => executeAndClose(cmd.action)}
                        >
                            <span class="command-bar-item-icon">{cmd.icon}</span>
                            <span class="command-bar-item-label">{cmd.label}</span>
                            {cmd.shortcut && (
                                <span class="command-bar-item-shortcut">{cmd.shortcut}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
