/** @filedesc Tailwind adapter for Signature — canvas drawing with styled clear button. */
import type { SignatureBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { createSignatureCanvas } from 'formspec-webcomponent';
import { el } from '../helpers';
import { createTailwindFieldDOM, TW } from './shared';

export const renderSignature: AdapterRenderFn<SignatureBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error, describedBy } = createTailwindFieldDOM(behavior, { labelFor: false });

    const { canvas, clear, dispose: canvasDispose } = createSignatureCanvas({
        height: behavior.height,
        strokeColor: behavior.strokeColor,
        eventTarget: root,
    });
    canvas.style.width = '100%';
    canvas.classList.add('rounded-md', 'border', 'border-gray-300');
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Signature canvas. Use the Clear button to reset.');
    canvas.setAttribute('aria-describedby', describedBy);

    root.appendChild(canvas);
    actx.onDispose(canvasDispose);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = TW.buttonOutline + ' mt-2';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', clear);
    root.appendChild(clearBtn);

    root.appendChild(error);
    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: canvas, hint, error,
        onValidationChange: (hasError) => {
            canvas.classList.toggle('border-red-500', hasError);
            canvas.classList.toggle('border-gray-300', !hasError);
        },
    });
    actx.onDispose(dispose);
};
