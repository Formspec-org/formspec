import type { Meta, StoryObj } from '@storybook/react';
import { SideBySideStory } from '../_shared/SideBySideStory';
import { selectDef, radioGroupDef, checkboxDef, checkboxGroupDef, searchableSelectDef } from './definitions';

const meta: Meta<typeof SideBySideStory> = {
    title: 'Fields/Choice',
    component: SideBySideStory,
};
export default meta;

type Story = StoryObj<typeof SideBySideStory>;

export const Select: Story = {
    args: { definition: selectDef },
};

export const RadioGroup: Story = {
    args: { definition: radioGroupDef },
};

export const Checkbox: Story = {
    args: { definition: checkboxDef },
};

export const CheckboxGroup: Story = {
    args: { definition: checkboxGroupDef },
};

export const SearchableSelect: Story = {
    name: 'Searchable Select',
    args: { definition: searchableSelectDef },
};
