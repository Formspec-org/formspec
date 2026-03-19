/** @filedesc Default adapter for FileUpload — reproduces current file input DOM structure. */
import type { FileUploadBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';

export const renderFileUpload: AdapterRenderFn<FileUploadBehavior> = (
    behavior, parent, actx
) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'formspec-field formspec-file-upload';
    wrapper.dataset.name = behavior.fieldPath;

    const label = document.createElement('label');
    label.className = 'formspec-label';
    label.textContent = behavior.label;
    wrapper.appendChild(label);

    const input = document.createElement('input');
    input.type = 'file';
    input.className = 'formspec-input';
    input.name = behavior.fieldPath;
    if (behavior.accept) input.accept = behavior.accept;
    if (behavior.multiple) input.multiple = true;

    if (behavior.dragDrop) {
        const dropZone = document.createElement('div');
        dropZone.className = 'formspec-drop-zone';
        dropZone.textContent = 'Drop files here or click to browse';

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
            // Dispatch custom event for behavior bind() to handle value storage
            wrapper.dispatchEvent(new CustomEvent('formspec-files-dropped', {
                detail: { fileData, multiple: behavior.multiple },
                bubbles: false,
            }));
        });
        dropZone.addEventListener('click', () => input.click());

        input.hidden = true;
        wrapper.appendChild(dropZone);
        wrapper.appendChild(input);
    } else {
        wrapper.appendChild(input);
    }

    actx.applyCssClass(wrapper, behavior.presentation);
    actx.applyAccessibility(wrapper, behavior.presentation);
    actx.applyStyle(wrapper, behavior.presentation.style);
    if (behavior.compOverrides.cssClass) actx.applyCssClass(wrapper, behavior.compOverrides);
    if (behavior.compOverrides.accessibility) actx.applyAccessibility(wrapper, behavior.compOverrides);
    if (behavior.compOverrides.style) actx.applyStyle(wrapper, behavior.compOverrides.style);
    parent.appendChild(wrapper);

    const dispose = behavior.bind({
        root: wrapper,
        label,
        control: input,
    });
    actx.onDispose(dispose);
};
