import type { Meta, StoryObj } from '@storybook/react';
import { SideBySideStory } from '../_shared/SideBySideStory';
import { repeatGroupDef, conditionalDef, validationDef } from './definitions';

const meta: Meta<typeof SideBySideStory> = {
    title: 'Behavior',
    component: SideBySideStory,
};
export default meta;

type Story = StoryObj<typeof SideBySideStory>;

export const ConditionalVisibility: Story = {
    name: 'Conditional Visibility',
    args: { definition: conditionalDef },
};

export const ValidationRules: Story = {
    name: 'Validation Rules',
    args: { definition: validationDef },
};

export const RepeatableGroup: Story = {
    name: 'Repeatable Group',
    args: { definition: repeatGroupDef },
};
