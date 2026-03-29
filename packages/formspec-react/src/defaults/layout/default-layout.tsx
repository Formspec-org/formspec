/** @filedesc Default layout component — semantic HTML containers with CSS class structure. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { LayoutComponentProps } from '../../component-map';

/**
 * Default layout renderer — dispatches to the correct container component
 * based on node.component, applying formspec CSS classes and theme styles.
 */
export function DefaultLayout({ node, children }: LayoutComponentProps) {
    const themeClass = node.cssClasses?.join(' ') || '';
    const style = node.style as React.CSSProperties | undefined;

    switch (node.component) {
        case 'Stack':
            return <StackLayout node={node} children={children} themeClass={themeClass} style={style} />;

        case 'Grid':
        case 'Columns':
            return <GridLayout node={node} children={children} themeClass={themeClass} style={style} />;

        case 'Card':
        case 'Section':
            return <CardLayout node={node} children={children} themeClass={themeClass} style={style} />;

        case 'Divider':
            return <DividerLayout node={node} themeClass={themeClass} style={style} />;

        case 'Page':
            return <PageLayout node={node} children={children} themeClass={themeClass} style={style} />;

        case 'Collapsible':
            return <CollapsibleLayout node={node} children={children} themeClass={themeClass} style={style} />;

        case 'Accordion':
            return <AccordionLayout node={node} children={children} themeClass={themeClass} style={style} />;

        case 'Panel':
            return <PanelLayout node={node} children={children} themeClass={themeClass} style={style} />;

        case 'Modal':
            return <ModalLayout node={node} children={children} themeClass={themeClass} style={style} />;

        case 'Popover':
            return <PopoverLayout node={node} children={children} themeClass={themeClass} style={style} />;

        default:
            return <DefaultContainer node={node} children={children} themeClass={themeClass} style={style} />;
    }
}

// ── Shared prop type ──────────────────────────────────────────────

interface LayoutProps {
    node: LayoutComponentProps['node'];
    children?: React.ReactNode;
    themeClass: string;
    style?: React.CSSProperties;
}

// ── Stack ─────────────────────────────────────────────────────────

function StackLayout({ node, children, themeClass, style }: LayoutProps) {
    const props = node.props ?? {};
    const direction = props.direction as string | undefined;
    const alignment = props.alignment as string | undefined;
    const wrap = props.wrap as boolean | undefined;
    const gap = (props.gap as string | undefined) ?? (style?.gap as string | undefined);

    const stackStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        ...(alignment ? { alignItems: alignment } : {}),
        ...(wrap ? { flexWrap: 'wrap' } : {}),
        ...style,
        // Props gap wins over theme style gap
        ...(gap ? { gap } : {}),
    };

    // When title + bindPath: treat as a titled group section (not a card —
    // the planner emits Stack for definition groups, Card for explicit cards)
    const title = props.title as string | undefined;
    if (title && node.bindPath) {
        return (
            <section className={themeClass || 'formspec-group'} style={node.style as React.CSSProperties}>
                <h3 className="formspec-group-title">{title}</h3>
                {children}
            </section>
        );
    }

    return (
        <div className={themeClass || 'formspec-stack'} style={stackStyle}>
            {children}
        </div>
    );
}

// ── Grid ─────────────────────────────────────────────────────────

function GridLayout({ node, children, themeClass, style }: LayoutProps) {
    const props = node.props ?? {};
    const columns = props.columns;
    const gap = props.gap as string | undefined;
    const rowGap = props.rowGap as string | undefined;

    let gridTemplateColumns: string | undefined;
    if (typeof columns === 'number') {
        gridTemplateColumns = `repeat(${columns}, 1fr)`;
    } else if (typeof columns === 'string') {
        gridTemplateColumns = columns;
    } else {
        gridTemplateColumns = 'repeat(1, 1fr)';
    }

    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns,
        gap: '1rem',
        ...(rowGap ? { rowGap } : {}),
        ...style,
        // Props gap/rowGap win over theme style
        ...(gap ? { gap } : {}),
        ...(rowGap ? { rowGap } : {}),
    };

    return (
        <div className={themeClass || 'formspec-grid'} style={gridStyle}>
            {children}
        </div>
    );
}

// ── Card / Section ────────────────────────────────────────────────

function CardLayout({ node, children, themeClass, style }: LayoutProps) {
    const props = node.props ?? {};
    const label = node.fieldItem?.label || (props.title as string | undefined);
    const subtitle = props.subtitle as string | undefined;
    const elevation = props.elevation as number | string | undefined;
    const headingLevel = Math.min(6, Math.max(1, (props.headingLevel as number | undefined) ?? 3));
    const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

    return (
        <section
            className={themeClass || 'formspec-card'}
            style={style}
            {...(elevation != null ? { 'data-elevation': String(elevation) } : {})}
        >
            {label && <Heading className="formspec-card-title">{label}</Heading>}
            {subtitle && <p className="formspec-card-subtitle">{subtitle}</p>}
            {children}
        </section>
    );
}

// ── Divider ───────────────────────────────────────────────────────

function DividerLayout({ node, themeClass, style }: Omit<LayoutProps, 'children'>) {
    const label = node.props?.label as string | undefined;

    if (label) {
        return (
            <div className={`${themeClass || 'formspec-divider'} formspec-divider--labeled`} style={style}>
                <hr />
                <span>{label}</span>
                <hr />
            </div>
        );
    }

    return <hr className={themeClass || 'formspec-divider'} style={style} />;
}

// ── Page ─────────────────────────────────────────────────────────

function PageLayout({ node, children, themeClass, style }: LayoutProps) {
    const props = node.props ?? {};
    const title = props.title as string | undefined;
    const description = props.description as string | undefined;
    const headingLevel = Math.min(6, Math.max(1, (props.headingLevel as number | undefined) ?? 2));
    const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

    return (
        <section className={themeClass || 'formspec-page'} style={style}>
            {title && <Heading>{title}</Heading>}
            {description && <p className="formspec-page-description">{description}</p>}
            {children}
        </section>
    );
}

// ── Collapsible ───────────────────────────────────────────────────

function CollapsibleLayout({ node, children, themeClass, style }: LayoutProps) {
    const props = node.props ?? {};
    const title = (props.title as string | undefined) ?? 'Details';
    const defaultOpen = props.defaultOpen as boolean | undefined;

    return (
        <details className={themeClass || 'formspec-collapsible'} style={style} open={defaultOpen || false}>
            <summary>{title}</summary>
            <div className="formspec-collapsible-content">
                {children}
            </div>
        </details>
    );
}

// ── Accordion ────────────────────────────────────────────────────

function AccordionLayout({ node, children, themeClass, style }: LayoutProps) {
    const props = node.props ?? {};
    const labels = (props.labels as string[] | undefined) ?? [];
    const defaultOpen = props.defaultOpen as number | undefined;
    const allowMultiple = props.allowMultiple as boolean | undefined;

    const containerRef = useRef<HTMLDivElement>(null);
    const childArray = React.Children.toArray(children);

    // Single-open mode: track one open index
    const [openIndex, setOpenIndex] = useState<number | null>(
        defaultOpen != null ? defaultOpen : null
    );

    // Multi-open mode: track a set of open indices
    const [openIndices, setOpenIndices] = useState<Set<number>>(() => {
        const initial = new Set<number>();
        if (defaultOpen != null) initial.add(defaultOpen);
        return initial;
    });

    const handleToggle = useCallback((idx: number, open: boolean) => {
        if (allowMultiple) {
            setOpenIndices(prev => {
                const next = new Set(prev);
                if (open) next.add(idx);
                else next.delete(idx);
                return next;
            });
        } else {
            setOpenIndex(open ? idx : null);
        }
    }, [allowMultiple]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const summaries = Array.from(
            containerRef.current?.querySelectorAll<HTMLElement>('summary') ?? []
        );
        if (summaries.length === 0) return;
        const focused = summaries.indexOf(document.activeElement as HTMLElement);
        if (focused === -1) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            summaries[Math.min(focused + 1, summaries.length - 1)]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            summaries[Math.max(focused - 1, 0)]?.focus();
        } else if (e.key === 'Home') {
            e.preventDefault();
            summaries[0]?.focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            summaries[summaries.length - 1]?.focus();
        }
    }, []);

    return (
        <div
            ref={containerRef}
            className={themeClass || 'formspec-accordion'}
            style={style}
            onKeyDown={handleKeyDown}
        >
            {childArray.map((child, idx) => {
                const label = labels[idx] ?? `Section ${idx + 1}`;
                const isOpen = allowMultiple ? openIndices.has(idx) : (openIndex === idx);
                return (
                    <details
                        key={idx}
                        className="formspec-accordion-item"
                        open={isOpen}
                        onToggle={(e) => handleToggle(idx, (e.currentTarget as HTMLDetailsElement).open)}
                    >
                        <summary>{label}</summary>
                        <div className="formspec-accordion-content">
                            {child}
                        </div>
                    </details>
                );
            })}
        </div>
    );
}

// ── Panel ─────────────────────────────────────────────────────────

function PanelLayout({ node, children, themeClass, style }: LayoutProps) {
    const props = node.props ?? {};
    const title = props.title as string | undefined;
    const position = props.position as string | undefined;
    const width = props.width as string | undefined;

    const panelStyle: React.CSSProperties = {
        ...(position === 'left' ? { order: -1 } : position === 'right' ? { order: 1 } : {}),
        ...(width ? { width } : {}),
        ...style,
    };

    return (
        <div className={themeClass || 'formspec-panel'} style={panelStyle}>
            {title && <div className="formspec-panel-header">{title}</div>}
            <div className="formspec-panel-body">
                {children}
            </div>
        </div>
    );
}

// ── Modal ─────────────────────────────────────────────────────────

function ModalLayout({ node, children, themeClass, style }: LayoutProps) {
    const props = node.props ?? {};
    const title = props.title as string | undefined;
    const triggerLabel = (props.triggerLabel as string | undefined) ?? 'Open';
    const closable = props.closable !== false;
    const size = props.size as string | undefined;
    const headingLevel = Math.min(6, Math.max(1, (props.headingLevel as number | undefined) ?? 2));
    const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const titleId = node.id ? `${node.id}-title` : 'modal-title';

    const openModal = useCallback(() => {
        dialogRef.current?.showModal();
        // Focus first focusable element inside dialog
        requestAnimationFrame(() => {
            const first = dialogRef.current?.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            first?.focus();
        });
    }, []);

    const closeModal = useCallback(() => {
        dialogRef.current?.close();
    }, []);

    // Backdrop click closes modal
    const handleDialogClick = useCallback((e: React.MouseEvent<HTMLDialogElement>) => {
        if (e.target === dialogRef.current) {
            closeModal();
        }
    }, [closeModal]);

    // Return focus to trigger on close
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const onClose = () => triggerRef.current?.focus();
        dialog.addEventListener('close', onClose);
        return () => dialog.removeEventListener('close', onClose);
    }, []);

    return (
        <>
            <button
                type="button"
                className="formspec-modal-trigger"
                ref={triggerRef}
                onClick={openModal}
            >
                {triggerLabel}
            </button>
            <dialog
                ref={dialogRef}
                className={themeClass || 'formspec-modal'}
                style={style}
                aria-labelledby={title ? titleId : undefined}
                aria-label={title ? undefined : triggerLabel}
                {...(size ? { 'data-size': size } : {})}
                onClick={handleDialogClick}
            >
                {closable && (
                    <button
                        type="button"
                        className="formspec-modal-close"
                        aria-label="Close"
                        onClick={closeModal}
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                )}
                {title && (
                    <Heading className="formspec-modal-title" id={titleId}>{title}</Heading>
                )}
                <div className="formspec-modal-content">
                    {children}
                </div>
            </dialog>
        </>
    );
}

// ── Popover ───────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusables(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function PopoverLayout({ node, children, themeClass, style }: LayoutProps) {
    const props = node.props ?? {};
    const triggerLabel = (props.triggerLabel as string | undefined) ?? 'Open';
    const title = props.title as string | undefined;

    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const close = useCallback(() => {
        setOpen(false);
        triggerRef.current?.focus();
    }, []);

    const toggle = useCallback(() => setOpen(v => {
        const next = !v;
        return next;
    }), []);

    // When opening: move focus into content container
    useEffect(() => {
        if (!open || !contentRef.current) return;
        const focusables = getFocusables(contentRef.current);
        if (focusables.length > 0) {
            focusables[0].focus();
        } else {
            contentRef.current.focus();
        }
    }, [open]);

    // Dismiss on outside click
    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                close();
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open, close]);

    // Focus trap + Escape dismiss
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            close();
            return;
        }
        if (e.key !== 'Tab' || !contentRef.current) return;

        const focusables = getFocusables(contentRef.current);
        if (focusables.length === 0) {
            e.preventDefault();
            return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first || document.activeElement === contentRef.current) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, [close]);

    return (
        <div
            ref={wrapperRef}
            className={themeClass || 'formspec-popover'}
            style={style}
        >
            <button
                type="button"
                ref={triggerRef}
                className="formspec-popover-trigger"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={toggle}
            >
                {triggerLabel}
            </button>
            <div
                ref={contentRef}
                className="formspec-popover-content"
                role="dialog"
                aria-label={title ?? triggerLabel}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                hidden={!open}
            >
                {children}
            </div>
        </div>
    );
}

// ── Generic fallback ──────────────────────────────────────────────

function DefaultContainer({ node, children, themeClass, style }: LayoutProps) {
    return (
        <div
            className={themeClass || `formspec-${node.component.toLowerCase()}`}
            style={style}
        >
            {children}
        </div>
    );
}
