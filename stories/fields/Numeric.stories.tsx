import type { Meta, StoryObj } from '@storybook/react';
import { SideBySideStory } from '../_shared/SideBySideStory';
import { numberInputDef, numberStepperDef, sliderDef, ratingDef, moneyInputDef } from './definitions';

const meta: Meta<typeof SideBySideStory> = {
    title: 'Fields/Numeric',
    component: SideBySideStory,
};
export default meta;

type Story = StoryObj<typeof SideBySideStory>;

export const NumberInput: Story = {
    args: { definition: numberInputDef },
};

export const NumberStepper: Story = {
    args: { definition: numberStepperDef },
};

export const Slider: Story = {
    args: { definition: sliderDef },
};

export const Rating: Story = {
    args: { definition: ratingDef },
};

export const MoneyInput: Story = {
    args: { definition: moneyInputDef },
};
