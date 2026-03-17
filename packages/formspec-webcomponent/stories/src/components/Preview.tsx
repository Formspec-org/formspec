/** @filedesc Wrapper component that mounts and updates a <formspec-render> custom element. */
import { useEffect, useRef } from 'preact/hooks';
import { forwardRef } from 'preact/compat';

// Teach TypeScript about the custom element
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace preact.JSX {
        interface IntrinsicElements {
            'formspec-render': Record<string, unknown>;
        }
    }
}

interface Props {
    definition: object | null;
    componentDoc: object | null;
    themeDoc: object | null;
}

export const Preview = forwardRef<HTMLElement, Props>(({ definition, componentDoc, themeDoc }, outerRef) => {
    const localRef = useRef<HTMLElement>(null);
    const ref = (outerRef as React.RefObject<HTMLElement>) ?? localRef;

    useEffect(() => {
        const el = ref.current as any;
        if (!el || !definition) return;
        el.themeDocument = themeDoc ?? null;
        el.definition = definition;
        el.componentDocument = componentDoc ?? null;
    }, [definition, componentDoc, themeDoc]);

    return (
        <div class="preview-wrap">
            <div class="preview-toolbar">
                <span class="preview-label">Preview</span>
            </div>
            <div class="preview-viewport">
                {/* @ts-ignore */}
                <formspec-render ref={ref} class="preview-renderer" />
            </div>
        </div>
    );
});
