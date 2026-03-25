/** @filedesc Default layout component — semantic HTML containers with theme cascade. */
import React from 'react';
import type { LayoutComponentProps } from '../../component-map';

/**
 * Default layout renderer — wraps children in a semantic container
 * with theme-resolved CSS classes and styles.
 */
export function DefaultLayout({ node, children }: LayoutComponentProps) {
    const cssClass = node.cssClasses?.join(' ') || '';
    const style = node.style as React.CSSProperties | undefined;

    // Card gets a heading from the bound group label
    if (node.component === 'Card' || node.component === 'Section') {
        const label = node.fieldItem?.label || node.props?.title as string;
        return (
            <section
                className={cssClass || `formspec-${node.component.toLowerCase()}`}
                style={style}
            >
                {label && <h3>{label}</h3>}
                {children}
            </section>
        );
    }

    // Grid/Columns get CSS grid
    if (node.component === 'Grid' || node.component === 'Columns') {
        const columns = (node.props?.columns as number) || 1;
        return (
            <div
                className={cssClass || 'formspec-grid'}
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: '1rem',
                    ...style,
                }}
            >
                {children}
            </div>
        );
    }

    // Stack (default) — vertical flex
    return (
        <div
            className={cssClass || `formspec-${node.component.toLowerCase()}`}
            style={style}
        >
            {children}
        </div>
    );
}
