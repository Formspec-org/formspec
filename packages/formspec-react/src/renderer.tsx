/** @filedesc FormspecForm — auto-renderer that walks LayoutNode tree into React elements. */
import React from 'react';
import type { LayoutNode } from 'formspec-layout';
import { FormspecProvider } from './context';
import type { FormspecProviderProps } from './context';
import { useFormspecContext } from './context';
import { FormspecNode } from './node-renderer';

export interface FormspecFormProps extends Omit<FormspecProviderProps, 'children'> {
    /** Optional className on the root container. */
    className?: string;
}

/**
 * Drop-in auto-renderer: takes a definition and renders the full form.
 *
 * Wraps itself in a FormspecProvider, plans the layout, and renders
 * each LayoutNode through the component map.
 */
export function FormspecForm({ className, ...providerProps }: FormspecFormProps) {
    return (
        <FormspecProvider {...providerProps}>
            <FormspecFormInner className={className} />
        </FormspecProvider>
    );
}

function FormspecFormInner({ className }: { className?: string }) {
    const { layoutPlan } = useFormspecContext();

    if (!layoutPlan) {
        return <div className={className}>No layout plan available.</div>;
    }

    return (
        <div className={className}>
            <FormspecNode node={layoutPlan} />
        </div>
    );
}
