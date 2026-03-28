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
}

export function USWDSSideBySideStory({
    definition,
    theme,
    componentDocument,
    showSubmit = true,
    maxWidth = 1400,
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
