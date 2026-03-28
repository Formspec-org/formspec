import type { Preview } from '@storybook/react';
import { initFormspecEngine } from '@formspec-org/engine';

// Default component styles (React stories)
import '../packages/formspec-react/src/formspec.css';
// Webcomponent CSS (formspec-default.css) is loaded from WebComponentStory.tsx
// rather than globally. Both CSS files share .formspec-* class names;
// the last-loaded wins for conflicting properties, but both provide
// matching system font stacks and similar visual treatment.

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
