import type { Meta, StoryObj } from '@storybook/react';
import { FormStory } from '../helpers/FormStory';
import { textInputDef, textInputDetailedDef, textareaDef } from '../helpers/definitions';

const meta: Meta<typeof FormStory> = {
    title: 'Fields/TextInput',
    component: FormStory,
};
export default meta;

type Story = StoryObj<typeof FormStory>;

export const Basic: Story = {
    args: { definition: textInputDef },
};

export const WithValidation: Story = {
    args: { definition: textInputDetailedDef },
};

export const Textarea: Story = {
    args: { definition: textareaDef },
};
