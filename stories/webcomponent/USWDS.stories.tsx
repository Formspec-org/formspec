import type { Meta, StoryObj } from '@storybook/react';
import { WebComponentStory } from '../_shared/WebComponentStory';
import { uswdsAdapter } from '@formspec-org/adapters';
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
    toggleDef,
} from '../fields/definitions';
import { repeatGroupDef, conditionalDef, validationDef } from '../behavior/definitions';

const meta: Meta<typeof WebComponentStory> = {
    title: 'Adapters/USWDS',
    component: WebComponentStory,
    parameters: {
        docs: {
            story: { inline: false },
            description: {
                component: 'The `<formspec-render>` custom element using the USWDS v3 adapter. Renders U.S. Web Design System markup patterns, typography, and component styling.',
            },
        },
    },
};
export default meta;

type Story = StoryObj<typeof WebComponentStory>;

const withUswds = (definition: any) => ({
    definition,
    adapter: uswdsAdapter,
});

export const TextInput: Story = {
    args: withUswds(textInputDef),
};

export const TextInputDetailed: Story = {
    args: withUswds(textInputDetailedDef),
};

export const Textarea: Story = {
    args: withUswds(textareaDef),
};

export const Select: Story = {
    args: withUswds(selectDef),
};

export const RadioGroup: Story = {
    args: withUswds(radioGroupDef),
};

export const Checkbox: Story = {
    args: withUswds(checkboxDef),
};

export const CheckboxGroup: Story = {
    args: withUswds(checkboxGroupDef),
};

export const NumberInput: Story = {
    args: withUswds(numberInputDef),
};

export const NumberStepper: Story = {
    args: withUswds(numberStepperDef),
};

export const DatePicker: Story = {
    args: withUswds(datePickerDef),
};

export const MoneyInput: Story = {
    args: withUswds(moneyInputDef),
};

export const Toggle: Story = {
    args: withUswds(toggleDef),
};

export const ContactForm: Story = {
    args: withUswds(contactFormDef),
};

export const Display: Story = {
    args: withUswds(displayDef),
};

export const RepeatGroup: Story = {
    args: withUswds(repeatGroupDef),
};

export const Conditional: Story = {
    args: withUswds(conditionalDef),
};

export const Validation: Story = {
    args: withUswds(validationDef),
};
