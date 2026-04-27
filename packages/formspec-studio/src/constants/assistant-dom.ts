/** @filedesc Stable `data-testid` / anchor ids for the assistant workspace and in-shell chat composer. */

export const ASSISTANT_WORKSPACE_TEST_ID = 'assistant-workspace';
export const ASSISTANT_COMPOSER_INPUT_TEST_ID = 'assistant-composer-input';

/**
 * Passed as `activeWorkspace` to `handleKeyboardShortcut` on the assistant surface so Delete/Backspace
 * never routes to Editor/Layout deletion (`DELETE_ALLOWED_WORKSPACES` in studio-core `keyboard.ts`).
 * Do not use `Editor` or `Layout` here.
 */
export const ASSISTANT_KEYBOARD_WORKSPACE = 'Evidence' as const;
