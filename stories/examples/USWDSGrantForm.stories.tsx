import type { Meta, StoryObj } from '@storybook/react';
import { WebComponentStory } from '../_shared/WebComponentStory';
import { uswdsAdapter } from '@formspec-org/adapters';
import definition from '../../examples/uswds-grant/grant.definition.json';
import theme from '../../examples/uswds-grant/grant.theme.json';

const meta: Meta<typeof WebComponentStory> = {
    title: 'Examples/USWDS Grant Form',
    component: WebComponentStory,
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

type Story = StoryObj<typeof WebComponentStory>;

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
