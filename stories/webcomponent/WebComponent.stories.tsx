import type { Meta, StoryObj } from '@storybook/react';
import { WebComponentStory } from '../helpers/WebComponentStory';
import {
    textInputDef,
    selectDef,
    radioGroupDef,
    checkboxDef,
    contactFormDef,
    groupedFormDef,
    numberInputDef,
    datePickerDef,
    toggleDef,
    checkboxGroupDef,
    fileUploadDef,
    displayDef,
    repeatGroupDef,
    conditionalDef,
    validationDef,
} from '../helpers/definitions';

const meta: Meta<typeof WebComponentStory> = {
    title: 'Web Component/Default',
    component: WebComponentStory,
    parameters: {
        docs: {
            story: { inline: false },
            description: {
                component: 'The `<formspec-render>` custom element with the built-in default renderer. Uses unstyled semantic HTML and CSS classes for layout and basic visual structure.',
            },
        },
    },
};
export default meta;

type Story = StoryObj<typeof WebComponentStory>;

export const TextInput: Story = {
    args: { definition: textInputDef },
};

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

export const NumberInput: Story = {
    args: { definition: numberInputDef },
};

export const DatePicker: Story = {
    args: { definition: datePickerDef },
};

export const Toggle: Story = {
    args: { definition: toggleDef },
};

export const FileUpload: Story = {
    args: { definition: fileUploadDef },
};

export const ContactForm: Story = {
    args: { definition: contactFormDef },
};

export const GroupedForm: Story = {
    args: { definition: groupedFormDef },
};

export const Display: Story = {
    args: { definition: displayDef },
};

export const RepeatGroup: Story = {
    args: { definition: repeatGroupDef },
};

export const Conditional: Story = {
    args: { definition: conditionalDef },
};

export const Validation: Story = {
    args: { definition: validationDef },
};
