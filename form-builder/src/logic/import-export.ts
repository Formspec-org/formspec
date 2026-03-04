import type { FormspecDefinition } from 'formspec-engine';
import { showToast } from '../state/toast';

export function handleImport(onDefinitionLoaded: (def: FormspecDefinition) => void) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result as string);
                if (parsed.$formspec) {
                    onDefinitionLoaded(parsed as FormspecDefinition);
                    showToast('Form imported successfully', 'success');
                } else {
                    showToast('Invalid Formspec definition', 'error');
                }
            } catch {
                showToast('Failed to parse JSON', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

export function handleExport(definition: FormspecDefinition) {
    const json = JSON.stringify(definition, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${definition.title || 'formspec'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Definition exported', 'success');
}
