/** @filedesc Default adapter for Signature — reproduces current canvas drawing DOM structure. */
import type { SignatureBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';

export const renderSignature: AdapterRenderFn<SignatureBehavior> = (
    behavior, parent, actx
) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'formspec-field formspec-signature';
    wrapper.dataset.name = behavior.fieldPath;

    const label = document.createElement('label');
    label.className = 'formspec-label';
    label.textContent = behavior.label;
    wrapper.appendChild(label);

    const canvas = document.createElement('canvas');
    canvas.className = 'formspec-signature-canvas';
    canvas.style.height = `${behavior.height}px`;
    wrapper.appendChild(canvas);

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
        // Store signature as data URL — dispatch custom event for behavior to handle
        wrapper.dispatchEvent(new CustomEvent('formspec-signature-drawn', {
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
        wrapper.dispatchEvent(new CustomEvent('formspec-signature-cleared', {
            bubbles: false,
        }));
    });
    wrapper.appendChild(clearBtn);

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
        control: canvas,
    });
    actx.onDispose(dispose);
};
