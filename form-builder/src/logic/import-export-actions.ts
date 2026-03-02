import { definition, setDefinition } from '../state/definition';
import { showToast } from '../state/toast';
import { pickAndReadJSONFile, exportDefinitionJSON } from './import-export';
import type { FormspecDefinition } from 'formspec-engine';

export async function handleImport(): Promise<void> {
  try {
    const def = await pickAndReadJSONFile();
    if (!def.url || !Array.isArray(def.items)) {
      showToast('Invalid definition: missing url or items', 'error');
      return;
    }
    setDefinition(def as FormspecDefinition);
    showToast('Definition imported successfully', 'success');
  } catch (e) {
    if ((e as Error).message === 'No file selected') return;
    showToast(`Import failed: ${(e as Error).message}`, 'error');
  }
}

export function handleExport(): void {
  const def = definition.value;
  try {
    exportDefinitionJSON(def);
    showToast('Definition exported', 'success');
  } catch (e) {
    showToast(`Export failed: ${(e as Error).message}`, 'error');
  }
}
