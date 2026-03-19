/** @filedesc Default adapter for Signature — canvas drawing with shared field infrastructure. */
import type { SignatureBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';
import { createFieldDOM, finalizeFieldDOM } from './shared';

export const renderSignature: AdapterRenderFn<SignatureBehavior> = (
    behavior, parent, actx
) => {
    const fieldDOM = createFieldDOM(behavior, actx);
    fieldDOM.root.classList.add('formspec-signature');

    const canvas = document.createElement('canvas');
    canvas.className = 'formspec-signature-canvas';
    canvas.style.height = `${behavior.height}px`;
    fieldDOM.root.appendChild(canvas);

    const dpr = window.devicePixelRatio || 1;
    const canvasCtx = canvas.getContext('2d')!;
    const strokeColor = behavior.strokeColor;

    const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvasCtx.scale(dpr, dpr);
    };
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);
    actx.onDispose(() => ro.disconnect());

    let drawing = false;

    const getPos = (e: MouseEvent | Touch) => {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    canvas.addEventListener('mousedown', (e) => {
        drawing = true;
        const pos = getPos(e);
        canvasCtx.beginPath();
        canvasCtx.moveTo(pos.x, pos.y);
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!drawing) return;
        const pos = getPos(e);
        canvasCtx.lineTo(pos.x, pos.y);
        canvasCtx.strokeStyle = strokeColor;
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
    });
    canvas.addEventListener('mouseup', () => {
        drawing = false;
        fieldDOM.root.dispatchEvent(new CustomEvent('formspec-signature-drawn', {
            detail: { dataUrl: canvas.toDataURL() },
            bubbles: false,
        }));
    });
    canvas.addEventListener('mouseleave', () => { drawing = false; });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    clearBtn.className = 'formspec-signature-clear';
    clearBtn.addEventListener('click', () => {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        fieldDOM.root.dispatchEvent(new CustomEvent('formspec-signature-cleared', {
            bubbles: false,
        }));
    });
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
