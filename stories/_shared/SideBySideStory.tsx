/** Side-by-side React and Web Component rendering for visual parity comparison. */
import React from 'react';
import { FormStory } from './FormStory';
import { WebComponentStory } from './WebComponentStory';

export interface SideBySideStoryProps {
    /** The Formspec definition JSON. */
    definition: any;
    /** Optional theme document. */
    theme?: any;
    /** Optional component document for layout planning. */
    componentDocument?: any;
    /** Whether to show a submit button. Defaults to true. */
    showSubmit?: boolean;
    /** Optional initial data (React renderer only). */
    initialData?: Record<string, any>;
    /** Optional max width for the full comparison surface. */
    maxWidth?: number | string;
    /** Optional override label for the left pane. */
    leftLabel?: string;
    /** Optional override label for the right pane. */
    rightLabel?: string;
    /** Optional custom left pane. When omitted, renders the default React story. */
    leftPane?: React.ReactNode;
    /** Optional custom right pane. When omitted, renders the default Web Component story. */
    rightPane?: React.ReactNode;
}

const labelStyle: React.CSSProperties = {
    margin: '0 0 12px',
    fontSize: 13,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
};

/** Renders the same Formspec definition through both React and Web Component renderers. */
export function SideBySideStory({
    definition,
    theme,
    componentDocument,
    showSubmit = true,
    initialData,
    maxWidth = '100%',
    leftLabel = 'React',
    rightLabel = 'Web Component',
    leftPane,
    rightPane,
}: SideBySideStoryProps) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 32,
                alignItems: 'start',
                maxWidth,
                margin: '0 auto',
            }}
        >
            <div>
                <div style={labelStyle}>{leftLabel}</div>
                {leftPane ?? (
                    <FormStory
                        definition={definition}
                        theme={theme}
                        componentDocument={componentDocument}
                        initialData={initialData}
                        showSubmit={showSubmit}
                    />
                )}
            </div>
            <div>
                <div style={labelStyle}>{rightLabel}</div>
                {rightPane ?? (
                    <WebComponentStory
                        definition={definition}
                        theme={theme}
                        componentDocument={componentDocument}
                        showSubmit={showSubmit}
                    />
                )}
            </div>
        </div>
    );
}
