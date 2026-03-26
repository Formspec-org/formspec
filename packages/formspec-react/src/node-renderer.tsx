/** @filedesc Recursive LayoutNode renderer — dispatches to field or layout components. */
import React, { useMemo, useRef, useCallback, useState } from 'react';
import { signal as createSignal } from '@preact/signals-core';
import type { LayoutNode } from 'formspec-layout';
import { useFormspecContext } from './context';
import { useSignal } from './use-signal';
import { useField } from './use-field';
import { useWhen } from './use-when';
import { useRepeatCount } from './use-repeat-count';
import type { FieldComponentProps, LayoutComponentProps } from './component-map';
import { DefaultField } from './defaults/fields/default-field';
import { DefaultLayout } from './defaults/layout/default-layout';

/** Render a single LayoutNode, recursing into children. */
export function FormspecNode({ node }: { node: LayoutNode }) {
    // Repeat template: render instances with add/remove controls
    if (node.isRepeatTemplate && node.repeatPath) {
        return <RepeatGroup node={node} />;
    }

    // Conditional rendering: evaluate `when` FEL expression
    if (node.when) {
        return <WhenGuard node={node} />;
    }

    if (node.category === 'field' && node.bindPath) {
        return <FieldNode node={node} />;
    }

    if (node.category === 'display') {
        return <DisplayNode node={node} />;
    }

    return <LayoutNodeRenderer node={node} />;
}

/** Evaluates a `when` FEL expression and conditionally renders the node. */
function WhenGuard({ node }: { node: LayoutNode }) {
    const visible = useWhen(node.when!, node.whenPrefix);

    if (!visible) return null;

    // Render the node without the `when` — strip it to avoid infinite recursion
    const innerNode = useMemo(
        () => ({ ...node, when: undefined, whenPrefix: undefined }),
        [node],
    );

    return <FormspecNode node={innerNode} />;
}

/** Renders a repeat group: stamps template children per instance. */
function RepeatGroup({ node }: { node: LayoutNode }) {
    const { engine } = useFormspecContext();
    const repeatPath = node.repeatPath!;
    const count = useRepeatCount(repeatPath);
    const title = (node.props?.title as string) || node.repeatGroup || repeatPath;
    const containerRef = useRef<HTMLDivElement>(null);
    const addBtnRef = useRef<HTMLButtonElement>(null);
    const [announcement, setAnnouncement] = useState('');

    // Build instances by rewriting template child bindPaths
    const instances = useMemo(() => {
        const result: LayoutNode[][] = [];
        for (let i = 0; i < count; i++) {
            result.push(
                node.children.map((child) => rewriteBindPaths(child, repeatPath, i)),
            );
        }
        return result;
    }, [node.children, repeatPath, count]);

    const handleAdd = useCallback(() => {
        engine.addRepeatInstance(repeatPath);
        const newCount = count + 1;
        setAnnouncement(`${title} ${newCount} added. ${newCount} total.`);
        // Focus first focusable element in the new instance after render
        setTimeout(() => {
            const instances = containerRef.current?.querySelectorAll('.formspec-repeat-instance');
            const last = instances?.[instances.length - 1];
            const firstInput = last?.querySelector<HTMLElement>('input, select, textarea, button');
            firstInput?.focus();
        }, 0);
    }, [engine, repeatPath, count, title]);

    const handleRemove = useCallback((idx: number) => {
        engine.removeRepeatInstance(repeatPath, idx);
        const newCount = count - 1;
        setAnnouncement(`${title} ${idx + 1} removed. ${newCount} remaining.`);
        // Focus: previous instance's first element, or the add button
        setTimeout(() => {
            if (newCount === 0) {
                addBtnRef.current?.focus();
            } else {
                const instances = containerRef.current?.querySelectorAll('.formspec-repeat-instance');
                const target = instances?.[Math.min(idx, newCount - 1)];
                const firstInput = target?.querySelector<HTMLElement>('input, select, textarea, button');
                firstInput?.focus();
            }
        }, 0);
    }, [engine, repeatPath, count, title]);

    return (
        <div className="formspec-repeat" data-bind={node.repeatGroup} ref={containerRef}>
            {instances.map((children, idx) => (
                <div key={idx} className="formspec-repeat-instance"
                     role="group"
                     aria-label={`${title} ${idx + 1} of ${count}`}>
                    {children.map((child) => (
                        <FormspecNode key={child.id} node={child} />
                    ))}
                    <button
                        type="button"
                        className="formspec-repeat-remove"
                        onClick={() => handleRemove(idx)}
                        aria-label={`Remove ${title} ${idx + 1}`}
                    >
                        Remove {title}
                    </button>
                </div>
            ))}
            <button
                type="button"
                className="formspec-repeat-add"
                onClick={handleAdd}
                ref={addBtnRef}
            >
                Add {title}
            </button>
            {/* Live region for add/remove announcements */}
            <div aria-live="polite" className="formspec-sr-only">{announcement}</div>
        </div>
    );
}

/** Renders a display node (Heading, Text, Divider, Alert) with semantic HTML. */
function DisplayNode({ node }: { node: LayoutNode }) {
    const text = (node.props?.text as string) || node.fieldItem?.label || '';
    const cssClass = node.cssClasses?.join(' ') || undefined;
    const style = node.style as React.CSSProperties | undefined;

    switch (node.component) {
        case 'Heading':
            return <h2 className={cssClass || 'formspec-heading'} style={style}>{text}</h2>;
        case 'Divider':
            return <hr className={cssClass || 'formspec-divider'} style={style} />;
        case 'Alert':
            return <div role="status" className={cssClass || 'formspec-alert'} style={style}>{text}</div>;
        case 'Text':
        default:
            return <p className={cssClass} style={style}>{text}</p>;
    }
}

/** Renders a field node via the component map or default. */
function FieldNode({ node }: { node: LayoutNode }) {
    const { components } = useFormspecContext();
    const field = useField(node.bindPath!);

    if (!field.visible && field.disabledDisplay !== 'protected') return null;

    const Component: React.ComponentType<FieldComponentProps> =
        components.fields?.[node.component] ?? DefaultField;

    return <Component field={field} node={node} />;
}

/** Wrapper that checks group-level relevance before rendering layout nodes. */
function LayoutNodeRenderer({ node }: { node: LayoutNode }) {
    if (node.bindPath) {
        return <RelevanceGatedLayout node={node} />;
    }
    return <LayoutNodeInner node={node} />;
}

const ALWAYS_RELEVANT = createSignal(true);

/** Subscribes to relevance signal for a layout node with a bind path. */
function RelevanceGatedLayout({ node }: { node: LayoutNode }) {
    const { engine } = useFormspecContext();
    const relevanceSignal = engine.relevantSignals[node.bindPath!] ?? ALWAYS_RELEVANT;
    const isRelevant = useSignal(relevanceSignal);
    if (!isRelevant) return null;
    return <LayoutNodeInner node={node} />;
}

/** Renders a layout node via the component map or default, recurses into children. */
function LayoutNodeInner({ node }: { node: LayoutNode }) {
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

/**
 * Deep-clone a LayoutNode tree, rewriting `bindPath` from template `[0]` to `[instanceIdx]`.
 * E.g., `members[0].memberName` -> `members[1].memberName`
 */
function rewriteBindPaths(node: LayoutNode, repeatPath: string, instanceIdx: number): LayoutNode {
    const templatePrefix = `${repeatPath}[0]`;
    const instancePrefix = `${repeatPath}[${instanceIdx}]`;

    const rewritten: LayoutNode = { ...node };

    if (rewritten.bindPath?.startsWith(templatePrefix)) {
        rewritten.bindPath = instancePrefix + rewritten.bindPath.slice(templatePrefix.length);
    }

    // Stable key per instance
    rewritten.id = `${node.id}-${instanceIdx}`;

    if (node.children.length > 0) {
        rewritten.children = node.children.map((child) =>
            rewriteBindPaths(child, repeatPath, instanceIdx),
        );
    }

    return rewritten;
}
