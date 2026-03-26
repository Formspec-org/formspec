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
import { Wizard } from './defaults/layout/wizard';
import { Tabs } from './defaults/layout/tabs';
import { ValidationSummary } from './validation-summary';

/**
 * Built-in layout component map. Components here are used by default when no
 * user override is provided via `components.layout`. This wires complex
 * components (Wizard, Tabs) into the rendering pipeline without requiring
 * consumers to register them manually.
 */
const BUILTIN_LAYOUT: Record<string, React.ComponentType<LayoutComponentProps>> = {
    Wizard,
    Tabs,
};

/**
 * Progressive component fallback map. When a component has no entry in the component map,
 * substitute its Core equivalent so Progressive components degrade gracefully.
 */
const FALLBACK_MAP: Record<string, string> = {
    MoneyInput: 'NumberInput',
    Slider: 'NumberInput',
    Rating: 'NumberInput',
    Signature: 'FileUpload',
    Badge: 'Text',
    ProgressBar: 'Text',
    Summary: 'Text',
    Panel: 'Card',
    Accordion: 'Collapsible',
    Modal: 'Collapsible',
    Popover: 'Collapsible',
    DataTable: 'Card',
    Tabs: 'Stack',
    Wizard: 'Stack',
};

/**
 * Minimal markdown-to-HTML converter. Handles the subset required by the Text
 * component spec: bold, italic, links, inline code, and newlines.
 */
function simpleMarkdown(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\n/g, '<br>');
}

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

    // container, interactive, special, and layout all route through LayoutNodeRenderer
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

/** Renders a display node — checks for user override before built-in rendering. */
function DisplayNode({ node }: { node: LayoutNode }) {
    const { components } = useFormspecContext();
    const text = (node.props?.text as string) || node.fieldItem?.label || '';

    // Check for user-provided display component override
    const Override = components.display?.[node.component];
    if (Override) {
        return <Override node={node} text={text} />;
    }

    const cssClass = node.cssClasses?.join(' ') || undefined;
    const style = node.style as React.CSSProperties | undefined;

    switch (node.component) {
        case 'Heading': {
            const level = (node.props?.level as number) || 2;
            const Tag = `h${Math.min(6, Math.max(1, level))}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
            return <Tag className={cssClass || 'formspec-heading'} style={style}>{text}</Tag>;
        }

        case 'Divider':
            return <hr className={cssClass || 'formspec-divider'} style={style} />;

        case 'Alert': {
            const severity = (node.props?.severity as string) || 'info';
            const alertRole = severity === 'error' ? 'alert' : 'status';
            return (
                <div
                    role={alertRole}
                    className={`formspec-alert formspec-alert--${severity}${cssClass ? ' ' + cssClass : ''}`}
                    style={style}
                >
                    {text}
                </div>
            );
        }

        case 'Badge': {
            const variant = (node.props?.variant as string) || 'default';
            return (
                <span
                    className={`formspec-badge formspec-badge--${variant}${cssClass ? ' ' + cssClass : ''}`}
                    style={style}
                >
                    {text}
                </span>
            );
        }

        case 'Spacer': {
            const height = (node.props?.size as string) || '1rem';
            return (
                <div
                    className={`formspec-spacer${cssClass ? ' ' + cssClass : ''}`}
                    style={{ height, ...style }}
                />
            );
        }

        case 'ProgressBar': {
            const value = (node.props?.value as number) ?? 0;
            const max = (node.props?.max as number) ?? 100;
            const showPercent = node.props?.showPercent === true;
            const pct = Math.round((value / max) * 100);
            const progressLabel = (node.props?.label as string) || 'Progress';
            return (
                <div className={`formspec-progress-bar${cssClass ? ' ' + cssClass : ''}`} style={style}>
                    <progress value={value} max={max} aria-label={progressLabel} />
                    {showPercent && (
                        <span className="formspec-progress-percent">{pct}%</span>
                    )}
                </div>
            );
        }

        case 'Summary': {
            const items = (node.props?.items as Array<{ label: string; bind?: string }>) || [];
            return (
                <SummaryDisplay node={node} items={items} cssClass={cssClass} style={style} />
            );
        }

        case 'DataTable':
            return <DataTableDisplay node={node} cssClass={cssClass} style={style} />;

        case 'ValidationSummary':
            return <ValidationSummaryDisplay />;

        case 'Text':
        default: {
            const format = node.props?.format as string | undefined;
            if (format === 'markdown') {
                return (
                    <p
                        className={cssClass}
                        style={style}
                        dangerouslySetInnerHTML={{ __html: simpleMarkdown(text) }}
                    />
                );
            }
            return <p className={cssClass} style={style}>{text}</p>;
        }
    }
}

/** Renders a Summary display node as a definition list with reactive field values. */
function SummaryDisplay({
    node,
    items,
    cssClass,
    style,
}: {
    node: LayoutNode;
    items: Array<{ label: string; bind?: string }>;
    cssClass: string | undefined;
    style: React.CSSProperties | undefined;
}) {
    return (
        <dl className={`formspec-summary${cssClass ? ' ' + cssClass : ''}`} style={style}>
            {items.map((item, i) => (
                <SummaryItem key={item.bind || i} label={item.label} bind={item.bind} />
            ))}
        </dl>
    );
}

const NO_VALUE = createSignal(null);

/** A single summary row — subscribes to its own field signal for targeted re-renders. */
function SummaryItem({ label, bind }: { label: string; bind?: string }) {
    const { engine } = useFormspecContext();
    const rawValue = useSignal(bind ? (engine.signals[bind] ?? NO_VALUE) : NO_VALUE);
    const displayValue = rawValue != null ? String(rawValue) : '\u2014';

    return (
        <>
            <dt>{label}</dt>
            <dd>{displayValue}</dd>
        </>
    );
}

/** A single DataTable cell — subscribes to its own signal for targeted re-renders. */
function DataTableCell({ signalPath }: { signalPath: string }) {
    const { engine } = useFormspecContext();
    const rawValue = useSignal(engine.signals[signalPath] ?? NO_VALUE);
    const displayValue = rawValue != null ? String(rawValue) : '';
    return <td>{displayValue}</td>;
}

/** Renders a DataTable display node as an HTML table. */
function DataTableDisplay({
    node,
    cssClass,
    style,
}: {
    node: LayoutNode;
    cssClass: string | undefined;
    style: React.CSSProperties | undefined;
}) {
    const { engine } = useFormspecContext();
    const bindKey = node.props?.bind as string | undefined;
    const columns = (node.props?.columns as Array<{ header: string; bind: string }>) || [];
    const allowAdd = node.props?.allowAdd === true;
    const allowRemove = node.props?.allowRemove === true;

    const repeatPath = bindKey || '';
    const count = useRepeatCount(repeatPath);

    const handleAdd = useCallback(() => {
        if (repeatPath) engine.addRepeatInstance(repeatPath);
    }, [engine, repeatPath]);

    const handleRemove = useCallback((idx: number) => {
        if (repeatPath) engine.removeRepeatInstance(repeatPath, idx);
    }, [engine, repeatPath]);

    if (!bindKey || columns.length === 0) {
        return (
            <div className={`formspec-data-table-wrapper${cssClass ? ' ' + cssClass : ''}`} style={style}>
                <table className="formspec-data-table" />
            </div>
        );
    }

    return (
        <div className={`formspec-data-table-wrapper${cssClass ? ' ' + cssClass : ''}`} style={style}>
            <table className="formspec-data-table">
                {(node.props?.title as string) && (
                    <caption>{node.props.title as string}</caption>
                )}
                <thead>
                    <tr>
                        {columns.map((col, ci) => (
                            <th key={ci} scope="col">{col.header}</th>
                        ))}
                        {allowRemove && (
                            <th scope="col"><span className="formspec-sr-only">Actions</span></th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: count }, (_, i) => (
                        <tr key={i}>
                            {columns.map((col, ci) => (
                                <DataTableCell key={ci} signalPath={`${bindKey}[${i}].${col.bind}`} />
                            ))}
                            {allowRemove && (
                                <td>
                                    <button
                                        type="button"
                                        className="formspec-datatable-remove"
                                        aria-label={`Remove row ${i + 1}`}
                                        onClick={() => handleRemove(i)}
                                    >
                                        Remove
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
            {allowAdd && (
                <button
                    type="button"
                    className="formspec-datatable-add"
                    onClick={handleAdd}
                >
                    Add Row
                </button>
            )}
        </div>
    );
}

/** Renders a live ValidationSummary display node using the current engine state. */
function ValidationSummaryDisplay() {
    const { engine } = useFormspecContext();
    const structureVersion = useSignal(engine.structureVersion);
    const report = engine.getValidationReport({ mode: 'continuous' });
    const results = report.results.map((r: any) => ({
        path: r.path || '',
        message: r.message || 'Validation error',
        severity: r.severity || 'error',
    }));
    return <ValidationSummary results={results} autoFocus={false} />;
}

/** Renders a field node via the component map or default. */
function FieldNode({ node }: { node: LayoutNode }) {
    const { components } = useFormspecContext();
    const field = useField(node.bindPath!);

    if (!field.visible && field.disabledDisplay !== 'protected') return null;

    // Resolve component: exact match → fallback substitution → DefaultField
    const componentName = node.component;
    const exact = components.fields?.[componentName];
    const fallbackName = !exact ? FALLBACK_MAP[componentName] : undefined;
    const Component: React.ComponentType<FieldComponentProps> =
        exact ??
        (fallbackName ? components.fields?.[fallbackName] : undefined) ??
        DefaultField;

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

    // Resolve component: user override → built-in → fallback substitution → DefaultLayout
    const componentName = node.component;
    const exact = components.layout?.[componentName];
    const builtin = !exact ? BUILTIN_LAYOUT[componentName] : undefined;
    const fallbackName = (!exact && !builtin) ? FALLBACK_MAP[componentName] : undefined;
    const Component: React.ComponentType<LayoutComponentProps> =
        exact ??
        builtin ??
        (fallbackName ? (components.layout?.[fallbackName] ?? BUILTIN_LAYOUT[fallbackName]) : undefined) ??
        DefaultLayout;

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
