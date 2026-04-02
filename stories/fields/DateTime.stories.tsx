import type { Meta, StoryObj } from '@storybook/react';
import { SideBySideStory } from '../_shared/SideBySideStory';
import { datePickerDef, dateTimePickerDef, timePickerDef } from './definitions';

const meta: Meta<typeof SideBySideStory> = {
    title: 'Fields/Date & Time',
    component: SideBySideStory,
};
export default meta;

type Story = StoryObj<typeof SideBySideStory>;

export const DatePicker: Story = {
    args: { definition: datePickerDef },
};

export const DateTimePicker: Story = {
    name: 'DateTime Picker',
    args: { definition: dateTimePickerDef },
};

export const TimePicker: Story = {
    name: 'Time Picker',
    args: { definition: timePickerDef },
};
