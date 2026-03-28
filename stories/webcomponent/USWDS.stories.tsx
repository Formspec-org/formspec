import type { Meta, StoryObj } from '@storybook/react';
import { USWDSSideBySideStory } from '../_shared/USWDSSideBySideStory';
import { contactFormDef, displayDef } from '../_shared/definitions';
import {
    textInputDef,
    textInputDetailedDef,
    textareaDef,
    selectDef,
    radioGroupDef,
    checkboxDef,
    checkboxGroupDef,
    numberInputDef,
    numberStepperDef,
    datePickerDef,
    moneyInputDef,
    sliderDef,
    toggleDef,
    fileUploadDef,
} from '../fields/definitions';
import { repeatGroupDef, conditionalDef, validationDef } from '../behavior/definitions';

const meta: Meta<typeof USWDSSideBySideStory> = {
    title: 'Adapters/USWDS',
    component: USWDSSideBySideStory,
    parameters: {
        docs: {
            story: { inline: false },
            description: {
                component: 'Compares the Formspec USWDS adapter against equivalent native U.S. Web Design System components. The real-USWDS pane runs the official component JavaScript inside an isolated shadow root so its CSS and behavior do not leak into the adapter pane.',
            },
        },
    },
};
export default meta;

type Story = StoryObj<typeof USWDSSideBySideStory>;

const withComparison = (definition: any) => ({
    definition,
    maxWidth: 1400,
});

export const TextInput: Story = {
    args: withComparison(textInputDef),
};

export const TextInputDetailed: Story = {
    args: withComparison(textInputDetailedDef),
};

export const Textarea: Story = {
    args: withComparison(textareaDef),
};

export const Select: Story = {
    args: withComparison(selectDef),
};

export const RadioGroup: Story = {
    args: withComparison(radioGroupDef),
};

export const Checkbox: Story = {
    args: withComparison(checkboxDef),
};

export const CheckboxGroup: Story = {
    args: withComparison(checkboxGroupDef),
};

export const NumberInput: Story = {
    args: withComparison(numberInputDef),
};

export const NumberStepper: Story = {
    args: withComparison(numberStepperDef),
};

export const DatePicker: Story = {
    args: withComparison(datePickerDef),
};

export const MoneyInput: Story = {
    args: withComparison(moneyInputDef),
};

export const Toggle: Story = {
    args: withComparison(toggleDef),
};

export const ContactForm: Story = {
    args: withComparison(contactFormDef),
};

export const Display: Story = {
    args: withComparison(displayDef),
};

export const RepeatGroup: Story = {
    args: withComparison(repeatGroupDef),
};

export const Conditional: Story = {
    args: withComparison(conditionalDef),
};

export const Validation: Story = {
    args: withComparison(validationDef),
};

export const Slider: Story = {
    args: withComparison(sliderDef),
};

export const FileUpload: Story = {
    args: withComparison(fileUploadDef),
};
