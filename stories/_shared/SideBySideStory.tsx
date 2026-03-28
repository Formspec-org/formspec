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
export function SideBySideStory({ definition, theme, componentDocument, showSubmit = true, initialData }: SideBySideStoryProps) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
            <div>
                <div style={labelStyle}>React</div>
                <FormStory
                    definition={definition}
                    theme={theme}
                    componentDocument={componentDocument}
                    initialData={initialData}
                    showSubmit={showSubmit}
                />
            </div>
            <div>
                <div style={labelStyle}>Web Component</div>
                <WebComponentStory
                    definition={definition}
                    theme={theme}
                    componentDocument={componentDocument}
                    showSubmit={showSubmit}
                />
            </div>
        </div>
    );
}
