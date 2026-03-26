/** @filedesc Default layout component — semantic HTML containers with CSS class structure. */
import React from 'react';
import type { LayoutComponentProps } from '../../component-map';

/**
 * Default layout renderer — wraps children in a semantic container
 * with formspec CSS class names and theme-resolved styles.
 */
export function DefaultLayout({ node, children }: LayoutComponentProps) {
    const themeClass = node.cssClasses?.join(' ') || '';
    const style = node.style as React.CSSProperties | undefined;

    // Card / Section — bordered card with optional heading
    if (node.component === 'Card' || node.component === 'Section') {
        const label = node.fieldItem?.label || node.props?.title as string;
        return (
            <section
                className={themeClass || 'formspec-card'}
                style={style}
            >
                {label && <h3 className="formspec-card-title">{label}</h3>}
                {children}
            </section>
        );
    }

    // Grid / Columns — CSS grid
    if (node.component === 'Grid' || node.component === 'Columns') {
        const columns = (node.props?.columns as number) || 1;
        return (
            <div
                className={themeClass || 'formspec-grid'}
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

    // Stack — default vertical container, with optional card treatment for titled groups
    const title = node.props?.title as string | undefined;
    if (title && node.bindPath) {
        return (
            <section
                className={themeClass || 'formspec-card'}
                style={style}
            >
                <h3 className="formspec-card-title">{title}</h3>
                {children}
            </section>
        );
    }

    return (
        <div
            className={themeClass || `formspec-${node.component.toLowerCase()}`}
            style={style}
        >
            {children}
        </div>
    );
}
