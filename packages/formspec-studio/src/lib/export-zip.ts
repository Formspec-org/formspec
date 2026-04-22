/** @filedesc Shared ZIP export logic for downloading a Formspec project bundle as a .zip file. */
import JSZip from 'jszip';

interface ExportBundle {
  definition: { title?: string };
  component: unknown;
  theme: unknown;
  mappings?: Record<string, unknown>;
}

export async function exportProjectZip(bundle: ExportBundle) {
  const { definition } = bundle;
  const baseName = definition.title?.trim()
    ? definition.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : 'formspec-project';

  const zip = new JSZip();
  zip.file('definition.json', JSON.stringify(bundle.definition, null, 2));
  zip.file('component.json', JSON.stringify(bundle.component, null, 2));
  zip.file('theme.json', JSON.stringify(bundle.theme, null, 2));

  if (bundle.mappings && Object.keys(bundle.mappings).length > 0) {
    const mappingsFolder = zip.folder('mappings');
    if (mappingsFolder) {
      for (const [key, mapping] of Object.entries(bundle.mappings)) {
        mappingsFolder.file(`${key}.json`, JSON.stringify(mapping, null, 2));
      }
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
