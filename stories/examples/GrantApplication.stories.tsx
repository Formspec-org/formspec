import type { Meta, StoryObj } from '@storybook/react';
import { SideBySideStory } from '../_shared/SideBySideStory';
import definition from '../../examples/react-demo/src/definition.json';
import theme from '../../examples/react-demo/src/theme.json';

const meta: Meta<typeof SideBySideStory> = {
    title: 'Examples/Grant Application',
    component: SideBySideStory,
    parameters: {
        docs: {
            description: {
                component: 'Community Impact Grant form from `examples/react-demo/`. Rendered side-by-side through React and Web Component renderers.',
            },
        },
    },
};
export default meta;

type Story = StoryObj<typeof SideBySideStory>;

export const Default: Story = {
    name: 'Community Impact Grant',
    args: { definition, theme },
};
