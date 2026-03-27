import type { Meta, StoryObj } from '@storybook/react';
import { FormStory } from '../helpers/FormStory';
import { repeatGroupDef, conditionalDef, validationDef, displayDef } from '../helpers/definitions';

const meta: Meta<typeof FormStory> = {
    title: 'Forms/Patterns',
    component: FormStory,
};
export default meta;

type Story = StoryObj<typeof FormStory>;

export const RepeatGroup: Story = {
    name: 'Repeatable Group',
    args: { definition: repeatGroupDef },
};

export const ConditionalFields: Story = {
    name: 'Conditional Visibility',
    args: { definition: conditionalDef },
};

export const Validation: Story = {
    name: 'Validation Rules',
    args: { definition: validationDef },
};

export const DisplayComponents: Story = {
    name: 'Display Elements',
    args: { definition: displayDef },
};
