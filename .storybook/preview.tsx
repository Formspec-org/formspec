import type { Preview } from '@storybook/react';
// Subpath import matches `formspec-webcomponent` so Vite keeps one wasm-bridge-runtime instance.
import { initFormspecEngine } from '@formspec-org/engine/init-formspec-engine';

// CSS is loaded inside shadow DOM by IsolatedFormStory / IsolatedWebComponentStory
// to prevent cross-renderer style collisions. No global CSS imports needed.

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
