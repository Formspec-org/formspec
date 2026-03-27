import type { Preview } from '@storybook/react';
import { initFormspecEngine } from '@formspec-org/engine';

// Default component styles (React stories)
import '../packages/formspec-react/src/formspec.css';
// Webcomponent CSS is NOT imported globally — formspec-layout.css conflicts
// with formspec-react's formspec.css (same class names, different styles).
// Webcomponent stories get their CSS via the package's own index.ts import.

let engineReady = false;

const preview: Preview = {
    loaders: [
        async () => {
            if (!engineReady) {
                await initFormspecEngine();
                engineReady = true;
            }
            return {};
        },
    ],
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
    },
};

export default preview;
