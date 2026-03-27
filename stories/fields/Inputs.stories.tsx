import type { Meta, StoryObj } from '@storybook/react';
import { FormStory } from '../helpers/FormStory';
import {
    selectDef,
    checkboxDef,
    radioGroupDef,
    checkboxGroupDef,
    numberInputDef,
    numberStepperDef,
    datePickerDef,
    moneyInputDef,
    sliderDef,
    ratingDef,
    fileUploadDef,
    toggleDef,
    signatureDef,
} from '../helpers/definitions';

const meta: Meta<typeof FormStory> = {
    title: 'Fields/Inputs',
    component: FormStory,
};
export default meta;

type Story = StoryObj<typeof FormStory>;

export const Select: Story = {
    args: { definition: selectDef },
};

export const Checkbox: Story = {
    args: { definition: checkboxDef },
};

export const RadioGroup: Story = {
    args: { definition: radioGroupDef },
};

export const CheckboxGroup: Story = {
    args: { definition: checkboxGroupDef },
};

export const NumberInput: Story = {
    args: { definition: numberInputDef },
};

export const NumberStepper: Story = {
    args: { definition: numberStepperDef },
};

export const DatePicker: Story = {
    args: { definition: datePickerDef },
};

export const MoneyInput: Story = {
    args: { definition: moneyInputDef },
};

export const Slider: Story = {
    args: { definition: sliderDef },
};

export const Rating: Story = {
    args: { definition: ratingDef },
};

export const FileUpload: Story = {
    args: { definition: fileUploadDef },
};

export const Toggle: Story = {
    args: { definition: toggleDef },
};

export const Signature: Story = {
    args: { definition: signatureDef },
};
