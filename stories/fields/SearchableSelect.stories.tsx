import type { Meta, StoryObj } from '@storybook/react';
import { FormStory } from '../helpers/FormStory';
import { searchableSelectDef } from '../helpers/definitions';

const meta: Meta<typeof FormStory> = {
    title: 'Fields/SearchableSelect',
    component: FormStory,
};
export default meta;

type Story = StoryObj<typeof FormStory>;

export const SearchableSelect: Story = {
    name: 'Searchable Select',
    args: { definition: searchableSelectDef },
};
