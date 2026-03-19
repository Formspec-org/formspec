/** @filedesc Default adapter for FileUpload — file input with optional drag-drop zone. */
import type { FileUploadBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';
import { createFieldDOM, finalizeFieldDOM } from './shared';

export const renderFileUpload: AdapterRenderFn<FileUploadBehavior> = (
    behavior, parent, actx
) => {
    const fieldDOM = createFieldDOM(behavior, actx);
    fieldDOM.root.classList.add('formspec-file-upload');

    const input = document.createElement('input');
    input.type = 'file';
    input.className = 'formspec-input';
    input.id = behavior.id;
    input.name = behavior.fieldPath;
    if (behavior.accept) input.accept = behavior.accept;
    if (behavior.multiple) input.multiple = true;

    if (behavior.dragDrop) {
        const dropZone = document.createElement('div');
        dropZone.className = 'formspec-drop-zone';
        dropZone.textContent = 'Drop files here or click to browse';

        dropZone.setAttribute('tabindex', '0');
        dropZone.setAttribute('role', 'button');
        dropZone.setAttribute('aria-label', 'Drop files here or click to browse');
        dropZone.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                input.click();
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('formspec-drop-zone--active');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('formspec-drop-zone--active');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('formspec-drop-zone--active');
            const files = Array.from(e.dataTransfer?.files || []);
            const fileData = files.map(f => ({ name: f.name, size: f.size, type: f.type }));
            fieldDOM.root.dispatchEvent(new CustomEvent('formspec-files-dropped', {
                detail: { fileData, multiple: behavior.multiple },
                bubbles: false,
            }));
        });
        dropZone.addEventListener('click', () => input.click());

        input.hidden = true;
        fieldDOM.root.appendChild(dropZone);
        fieldDOM.root.appendChild(input);
    } else {
        fieldDOM.root.appendChild(input);
    }

    finalizeFieldDOM(fieldDOM, behavior, actx);
    parent.appendChild(fieldDOM.root);

    const dispose = behavior.bind({
        root: fieldDOM.root,
        label: fieldDOM.label,
        control: input,
        hint: fieldDOM.hint,
        error: fieldDOM.error,
    });
    actx.onDispose(dispose);
};
