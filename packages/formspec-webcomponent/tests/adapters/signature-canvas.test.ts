/** @filedesc Tests for the shared signature canvas drawing utility. */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock canvas context before any imports that use it
function mockCanvasContext(): void {
    const proto = HTMLCanvasElement.prototype;
    if (!(proto as any).__mocked) {
        const original = proto.getContext;
        (proto as any).getContext = function (type: string) {
            if (type === '2d') {
                return {
                    beginPath: vi.fn(),
                    moveTo: vi.fn(),
                    lineTo: vi.fn(),
                    stroke: vi.fn(),
                    clearRect: vi.fn(),
                    setTransform: vi.fn(),
                    scale: vi.fn(),
                    strokeStyle: '',
                    lineWidth: 1,
                };
            }
            return original.call(this, type);
        };
        (proto as any).__mocked = true;
    }
}

beforeAll(() => { mockCanvasContext(); });

describe('createSignatureCanvas', () => {
    let createSignatureCanvas: typeof import('../../src/adapters/signature-canvas').createSignatureCanvas;

    beforeAll(async () => {
        const mod = await import('../../src/adapters/signature-canvas');
        createSignatureCanvas = mod.createSignatureCanvas;
    });

    it('exports a createSignatureCanvas function', () => {
        expect(typeof createSignatureCanvas).toBe('function');
    });

    it('returns canvas element and clear/dispose functions', () => {
        const root = document.createElement('div');
        const result = createSignatureCanvas({
            height: 200,
            strokeColor: '#000',
            eventTarget: root,
        });
        expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
        expect(result.canvas.className).toBe('formspec-signature-canvas');
        expect(typeof result.clear).toBe('function');
        expect(typeof result.dispose).toBe('function');
    });

    it('dispatches formspec-signature-drawn on mouseup', () => {
        const root = document.createElement('div');
        const drawn = vi.fn();
        root.addEventListener('formspec-signature-drawn', drawn);

        const { canvas } = createSignatureCanvas({
            height: 200,
            strokeColor: '#000',
            eventTarget: root,
        });

        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10 }));
        canvas.dispatchEvent(new MouseEvent('mouseup'));
        expect(drawn).toHaveBeenCalled();
    });

    it('dispatches formspec-signature-drawn on touchend', () => {
        const root = document.createElement('div');
        const drawn = vi.fn();
        root.addEventListener('formspec-signature-drawn', drawn);

        const { canvas } = createSignatureCanvas({
            height: 200,
            strokeColor: '#000',
            eventTarget: root,
        });

        const touch = { clientX: 50, clientY: 50, identifier: 0, target: canvas };
        canvas.dispatchEvent(new TouchEvent('touchstart', {
            touches: [touch as any], bubbles: true,
        }));
        canvas.dispatchEvent(new TouchEvent('touchend', {
            touches: [], bubbles: true,
        }));
        expect(drawn).toHaveBeenCalled();
    });

    it('prevents default on touchstart to block scrolling', () => {
        const root = document.createElement('div');
        const { canvas } = createSignatureCanvas({
            height: 200,
            strokeColor: '#000',
            eventTarget: root,
        });

        const touch = { clientX: 50, clientY: 50, identifier: 0, target: canvas };
        const event = new TouchEvent('touchstart', {
            touches: [touch as any], cancelable: true, bubbles: true,
        });
        canvas.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });

    it('clear() dispatches formspec-signature-cleared', () => {
        const root = document.createElement('div');
        const cleared = vi.fn();
        root.addEventListener('formspec-signature-cleared', cleared);

        const { clear } = createSignatureCanvas({
            height: 200,
            strokeColor: '#000',
            eventTarget: root,
        });

        clear();
        expect(cleared).toHaveBeenCalled();
    });

    it('dispose() disconnects ResizeObserver', () => {
        const root = document.createElement('div');
        const { dispose } = createSignatureCanvas({
            height: 200,
            strokeColor: '#000',
            eventTarget: root,
        });

        // Should not throw
        dispose();
    });
});
