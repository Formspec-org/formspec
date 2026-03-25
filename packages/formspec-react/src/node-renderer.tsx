/** @filedesc Recursive LayoutNode renderer — dispatches to field or layout components. */
import React from 'react';
import type { LayoutNode } from 'formspec-layout';
import { useFormspecContext } from './context';
import { useField } from './use-field';
import type { FieldComponentProps, LayoutComponentProps } from './component-map';
import { DefaultField } from './defaults/fields/default-field';
import { DefaultLayout } from './defaults/layout/default-layout';

/** Render a single LayoutNode, recursing into children. */
export function FormspecNode({ node }: { node: LayoutNode }) {
    if (node.category === 'field' && node.bindPath) {
        return <FieldNode node={node} />;
    }

    return <LayoutNodeRenderer node={node} />;
}

/** Renders a field node via the component map or default. */
function FieldNode({ node }: { node: LayoutNode }) {
    const { components } = useFormspecContext();
    const field = useField(node.bindPath!);

    if (!field.visible) return null;

    const Component: React.ComponentType<FieldComponentProps> =
        components.fields?.[node.component] ?? DefaultField;

    return <Component field={field} node={node} />;
}

/** Renders a layout node via the component map or default, recurses into children. */
function LayoutNodeRenderer({ node }: { node: LayoutNode }) {
    const { components } = useFormspecContext();

    const Component: React.ComponentType<LayoutComponentProps> =
        components.layout?.[node.component] ?? DefaultLayout;

    return (
        <Component node={node}>
            {node.children.map((child) => (
                <FormspecNode key={child.id} node={child} />
            ))}
        </Component>
    );
}
