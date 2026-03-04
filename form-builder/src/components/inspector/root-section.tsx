import { definition, updateDefinition } from '../../state/definition';

export function RootSection() {
    const def = definition.value;

    function updateRoot(field: string, value: string) {
        updateDefinition((d) => {
            (d as Record<string, unknown>)[field] = value || undefined;
        });
    }

    return (
        <div class="properties-content">
            <div class="property-type-header">
                <span class="property-type-dot" style={{ background: 'var(--accent)' }} />
                Form Root
            </div>

            <div class="section-title">Definition</div>
            <div class="property-row">
                <label class="property-label">Title</label>
                <input
                    class="studio-input"
                    value={def.title ?? ''}
                    onInput={(e) => updateRoot('title', (e.target as HTMLInputElement).value)}
                />
            </div>
            <div class="property-row">
                <label class="property-label">URL</label>
                <input
                    class="studio-input studio-input-mono"
                    value={def.url ?? ''}
                    onInput={(e) => updateRoot('url', (e.target as HTMLInputElement).value)}
                />
            </div>
            <div class="property-row">
                <label class="property-label">Version</label>
                <input
                    class="studio-input studio-input-mono"
                    value={def.version ?? ''}
                    placeholder="0.1.0"
                    onInput={(e) => updateRoot('version', (e.target as HTMLInputElement).value)}
                />
            </div>
            <div class="property-row">
                <label class="property-label">Status</label>
                <select
                    class="studio-select"
                    value={(def as Record<string, unknown>).status as string ?? 'draft'}
                    onChange={(e) => updateRoot('status', (e.target as HTMLSelectElement).value)}
                >
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                    <option value="deprecated">deprecated</option>
                    <option value="archived">archived</option>
                </select>
            </div>
            <div class="property-row">
                <label class="property-label">Description</label>
                <textarea
                    class="studio-textarea"
                    value={(def as Record<string, unknown>).description as string ?? ''}
                    placeholder="Describe this form..."
                    onInput={(e) => updateRoot('description', (e.target as HTMLTextAreaElement).value)}
                />
            </div>
        </div>
    );
}
