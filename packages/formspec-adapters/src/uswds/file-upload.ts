/** @filedesc USWDS v3 adapter for FileUpload — usa-file-input with drag-drop target. */
import type { FileUploadBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { el } from '../helpers';
import { applyUSWDSValidationState, createUSWDSFieldDOM } from './shared';

export const renderFileUpload: AdapterRenderFn<FileUploadBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error, describedBy: _describedBy } = createUSWDSFieldDOM(behavior);

    // USWDS file input wrapper
    const fileInput = el('div', { class: 'usa-file-input' });
    const target = el('div', {
        class: 'usa-file-input__target',
        tabindex: '0',
        role: 'button',
        'aria-label': 'Drop files here or press Enter to browse',
    });
    target.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            input.click();
        }
    });

    const instructions = el('div', { class: 'usa-file-input__instructions' });
    const chooseSpan = el('span', { class: 'usa-file-input__choose' });
    chooseSpan.textContent = 'choose from folder';
    instructions.appendChild(document.createTextNode('Drag file here or '));
    instructions.appendChild(chooseSpan);
    target.appendChild(instructions);

    const input = document.createElement('input') as HTMLInputElement;
    input.className = 'usa-file-input__input';
    input.id = behavior.id;
    input.name = behavior.fieldPath;
    input.type = 'file';
    if (behavior.accept) input.accept = behavior.accept;
    if (behavior.multiple) input.multiple = true;
    target.appendChild(input);

    // Drag-drop handlers on the target div
    if (behavior.dragDrop) {
        target.addEventListener('dragover', (e) => {
            e.preventDefault();
            target.classList.add('usa-file-input__target--drag');
        });
        target.addEventListener('dragleave', () => {
            target.classList.remove('usa-file-input__target--drag');
        });
        target.addEventListener('drop', (e) => {
            e.preventDefault();
            target.classList.remove('usa-file-input__target--drag');
            const files = Array.from(e.dataTransfer?.files || []);
            const fileData = files.map(f => ({ name: f.name, size: f.size, type: f.type }));
            root.dispatchEvent(new CustomEvent('formspec-files-dropped', {
                detail: { fileData, multiple: behavior.multiple },
                bubbles: false,
            }));
        });
    }

    fileInput.appendChild(target);
    root.appendChild(fileInput);

    root.appendChild(error);

    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: input, hint, error,
        onValidationChange: (hasError) => {
            applyUSWDSValidationState(root, label, hasError);
        },
    });
    actx.onDispose(dispose);
};
