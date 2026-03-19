/** @filedesc Default adapter for Signature — canvas drawing with shared field infrastructure. */
import type { SignatureBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';
import { createFieldDOM, finalizeFieldDOM } from './shared';
import { createSignatureCanvas } from '../signature-canvas';

export const renderSignature: AdapterRenderFn<SignatureBehavior> = (
    behavior, parent, actx
) => {
    const fieldDOM = createFieldDOM(behavior, actx);
    fieldDOM.root.classList.add('formspec-signature');

    const { canvas, clear, dispose: canvasDispose } = createSignatureCanvas({
        height: behavior.height,
        strokeColor: behavior.strokeColor,
        eventTarget: fieldDOM.root,
    });
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-roledescription', 'signature pad');
    canvas.setAttribute('aria-label', 'Signature canvas. Draw your signature or use the Clear button to reset.');
    fieldDOM.root.appendChild(canvas);
    actx.onDispose(canvasDispose);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    clearBtn.className = 'formspec-signature-clear';
    clearBtn.addEventListener('click', clear);
    fieldDOM.root.appendChild(clearBtn);

    finalizeFieldDOM(fieldDOM, behavior, actx);
    parent.appendChild(fieldDOM.root);

    const dispose = behavior.bind({
        root: fieldDOM.root,
        label: fieldDOM.label,
        control: canvas,
        hint: fieldDOM.hint,
        error: fieldDOM.error,
    });
    actx.onDispose(dispose);
};
