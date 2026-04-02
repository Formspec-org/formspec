import type { Meta, StoryObj } from '@storybook/react';
import { IsolatedWebComponentStory } from '../_shared/IsolatedWebComponentStory';
import { uswdsAdapter } from '@formspec-org/adapters';
import definition from '../../examples/uswds-grant/grant.definition.json';
import theme from '../../examples/uswds-grant/grant.theme.json';

const meta: Meta<typeof IsolatedWebComponentStory> = {
    title: 'Examples/USWDS Grant Form',
    component: IsolatedWebComponentStory,
    parameters: {
        docs: {
            story: { inline: false },
            description: {
                component: 'Full USWDS grant application form from `examples/uswds-grant/`. Rendered via the **Web Component** (`<formspec-render>`) with the USWDS v3 adapter.',
            },
        },
    },
};
export default meta;

type Story = StoryObj<typeof IsolatedWebComponentStory>;

export const WithUSWDSAdapter: Story = {
    name: 'USWDS Adapter',
    args: {
        definition,
        theme,
        adapter: uswdsAdapter,
        maxWidth: 800,
    },
};

export const WithDefaultRenderer: Story = {
    name: 'Default Renderer',
    args: {
        definition,
        theme,
        maxWidth: 800,
    },
};
