import type { Meta, StoryObj } from '@storybook/react';
import { SideBySideStory } from '../_shared/SideBySideStory';
import { textInputDef, textInputDetailedDef, textareaDef } from './definitions';

const meta: Meta<typeof SideBySideStory> = {
    title: 'Fields/Text',
    component: SideBySideStory,
};
export default meta;

type Story = StoryObj<typeof SideBySideStory>;

export const Basic: Story = {
    args: { definition: textInputDef },
};

export const WithValidation: Story = {
    args: { definition: textInputDetailedDef },
};

export const Textarea: Story = {
    args: { definition: textareaDef },
};
