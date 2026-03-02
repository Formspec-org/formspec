import type { FormspecDefinition } from 'formspec-engine';

/**
 * Parse a JSON string into a FormspecDefinition.
 * Throws on invalid JSON or missing required fields.
 */
export function parseDefinitionJSON(jsonString: string): FormspecDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Definition must be a JSON object');
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj['url'] !== 'string' || obj['url'] === '') {
    throw new Error('Definition is missing required field: url');
  }
  if (!Array.isArray(obj['items'])) {
    throw new Error('Definition is missing required field: items');
  }

  return parsed as FormspecDefinition;
}

/**
 * Serialize a definition to a pretty-printed JSON string.
 */
export function serializeDefinition(def: FormspecDefinition): string {
  return JSON.stringify(def, null, 2);
}

/**
 * Trigger a browser file download with the given content and filename.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function kebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Export a definition as a JSON file download.
 * Filename is derived from the definition title if present.
 */
export function exportDefinitionJSON(def: FormspecDefinition): void {
  const json = serializeDefinition(def);
  const filename = def.title ? `${kebabCase(def.title)}-definition.json` : 'definition.json';
  downloadFile(json, filename, 'application/json');
}

/**
 * Open a file picker dialog and read the selected JSON file.
 * Returns a promise that resolves with the parsed definition.
 * Rejects with an error if no file is selected, the file is not valid JSON,
 * or the file cannot be read.
 */
export function pickAndReadJSONFile(): Promise<FormspecDefinition> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          resolve(parsed as FormspecDefinition);
        } catch {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };
    input.click();
  });
}
