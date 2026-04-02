/** Side-by-side comparison of the USWDS adapter against the real USWDS component system. */
import React from 'react';
import { uswdsAdapter } from '@formspec-org/adapters';
import { SideBySideStory } from './SideBySideStory';
import { IsolatedWebComponentStory } from './IsolatedWebComponentStory';
import { RealUSWDSStory } from './RealUSWDSStory';

export interface USWDSSideBySideStoryProps {
    definition: any;
    theme?: any;
    componentDocument?: any;
    showSubmit?: boolean;
    maxWidth?: number;
    /** Optional initial field values to show pre-filled (and trigger validation). */
    initialData?: Record<string, any>;
    /** When true, all fields are touched on mount so validation errors display immediately. */
    touchAll?: boolean;
}

export function USWDSSideBySideStory({
    definition,
    theme,
    componentDocument,
    showSubmit = true,
    maxWidth = 1400,
    initialData,
    touchAll,
}: USWDSSideBySideStoryProps) {
    return (
        <SideBySideStory
            definition={definition}
            theme={theme}
            componentDocument={componentDocument}
            showSubmit={showSubmit}
            maxWidth={maxWidth}
            leftLabel="USWDS Adapter"
            rightLabel="Real USWDS"
            leftPane={(
                <IsolatedWebComponentStory
                    definition={definition}
                    theme={theme}
                    componentDocument={componentDocument}
                    adapter={uswdsAdapter}
                    showSubmit={showSubmit}
                    maxWidth={640}
                    initialData={initialData}
                    touchAll={touchAll}
                />
            )}
            rightPane={(
                <RealUSWDSStory
                    definition={definition}
                    componentDocument={componentDocument}
                    showSubmit={showSubmit}
                    maxWidth={640}
                />
            )}
        />
    );
}
