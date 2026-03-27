import type { Meta, StoryObj } from '@storybook/react';
import { WebComponentStory } from '../helpers/WebComponentStory';
import { uswdsAdapter } from '@formspec-org/adapters';
import definition from '../../examples/uswds-grant/grant.definition.json';
import theme from '../../examples/uswds-grant/grant.theme.json';

const meta: Meta<typeof WebComponentStory> = {
    title: 'Web Component/USWDS Grant Application',
    component: WebComponentStory,
    parameters: {
        docs: {
            story: { inline: false },
            description: {
                component: 'Full USWDS grant application form — the complete example from `examples/uswds-grant/`. Demonstrates a real-world form with multiple sections, conditional logic, and validation.',
            },
        },
    },
};
export default meta;

type Story = StoryObj<typeof WebComponentStory>;

export const GrantApplicationUSWDS: Story = {
    name: 'Grant Application (USWDS)',
    args: {
        definition,
        theme,
        adapter: uswdsAdapter,
        maxWidth: 800,
    },
};

export const GrantApplicationDefault: Story = {
    name: 'Grant Application (Default)',
    args: {
        definition,
        theme,
        maxWidth: 800,
    },
};
