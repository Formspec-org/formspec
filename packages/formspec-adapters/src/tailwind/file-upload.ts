/** @filedesc Tailwind adapter for FileUpload — drag-drop zone with styled file input. */
import type { FileUploadBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el } from '../helpers';
import { createTailwindFieldDOM } from './shared';

export const renderFileUpload: AdapterRenderFn<FileUploadBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error } = createTailwindFieldDOM(behavior);

    // Drop zone
    const dropZone = el('div', {
        class: 'flex justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 transition-colors',
        tabindex: '0',
        role: 'button',
        'aria-label': 'Drop files here or press Enter to browse',
    });

    dropZone.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            input.click();
        }
    });

    const inner = el('div', { class: 'text-center' });

    // Upload icon (SVG inline for Tailwind aesthetic)
    const iconWrapper = el('div', { class: 'mx-auto h-12 w-12 text-gray-400' });
    iconWrapper.innerHTML = '<svg class="h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>';
    inner.appendChild(iconWrapper);

    const textRow = el('div', { class: 'mt-4 flex text-sm text-gray-600' });
    const browseLabel = el('span', {
        class: 'relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500',
    });
    browseLabel.textContent = 'Upload a file';
    textRow.appendChild(browseLabel);
    textRow.appendChild(document.createTextNode('\u00a0or drag and drop'));
    inner.appendChild(textRow);

    const sizeHint = el('p', { class: 'text-xs text-gray-500 mt-1' });
    sizeHint.textContent = behavior.accept || 'Any file type';
    inner.appendChild(sizeHint);

    dropZone.appendChild(inner);

    const input = document.createElement('input') as HTMLInputElement;
    input.className = 'sr-only';
    input.id = behavior.id;
    input.name = behavior.fieldPath;
    input.type = 'file';
    if (behavior.accept) input.accept = behavior.accept;
    if (behavior.multiple) input.multiple = true;
    dropZone.appendChild(input);

    // Drag-drop handlers
    if (behavior.dragDrop) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-blue-400', 'bg-blue-50');
            dropZone.classList.remove('border-gray-300');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-blue-400', 'bg-blue-50');
            dropZone.classList.add('border-gray-300');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-blue-400', 'bg-blue-50');
            dropZone.classList.add('border-gray-300');
            const files = Array.from(e.dataTransfer?.files || []);
            const fileData = files.map(f => ({ name: f.name, size: f.size, type: f.type }));
            root.dispatchEvent(new CustomEvent('formspec-files-dropped', {
                detail: { fileData, multiple: behavior.multiple },
                bubbles: false,
            }));
        });
    }

    root.appendChild(dropZone);
    root.appendChild(error);
    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: input, hint, error,
        onValidationChange: (hasError) => {
            dropZone.classList.toggle('border-red-500', hasError);
            dropZone.classList.toggle('border-gray-300', !hasError);
        },
    });
    actx.onDispose(dispose);
};
