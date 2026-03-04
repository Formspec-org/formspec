import { signal } from '@preact/signals';

export interface AddPickerState {
    parentPath: string;
    insertIndex: number;
}

/** Currently selected component tree path. null = nothing, '' = root */
export const selectedPath = signal<string | null>(null);

/** Active add picker state, if picker is open */
export const addPickerState = signal<AddPickerState | null>(null);
