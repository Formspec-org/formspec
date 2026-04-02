/** @filedesc Storybook: USWDS adapter vs real USWDS — field and display comparisons. */
import type { Meta, StoryObj } from '@storybook/react';
import { USWDSSideBySideStory } from '../../_shared/USWDSSideBySideStory';
import { uswdsComparisonArgs } from '../../_shared/uswds-comparison-story-args';
import { contactFormDef, displayDef } from '../../_shared/definitions';
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
} from '../../fields/definitions';
import { repeatGroupDef, conditionalDef, validationDef, validationDemoComponentDoc } from '../../behavior/definitions';

const meta: Meta<typeof USWDSSideBySideStory> = {
    title: 'Adapters/USWDS',
    component: USWDSSideBySideStory,
    parameters: {
        docs: {
            story: { inline: false },
            description: {
                component: 'Compares the Formspec USWDS adapter against equivalent native U.S. Web Design System components. The real-USWDS pane runs the official component JavaScript inside an isolated shadow root so its CSS and behavior do not leak into the adapter pane. When a definition title matches a comparison preset (Conditional, Repeat Group, Validation), both panes receive the same initial state via `stories/_shared/uswds-comparison-presets.ts`.',
            },
        },
    },
};
export default meta;

type Story = StoryObj<typeof USWDSSideBySideStory>;

export const TextInput: Story = {
    args: uswdsComparisonArgs({ definition: textInputDef }),
};

export const TextInputDetailed: Story = {
    args: uswdsComparisonArgs({ definition: textInputDetailedDef }),
};

export const Textarea: Story = {
    args: uswdsComparisonArgs({ definition: textareaDef }),
};

export const Select: Story = {
    args: uswdsComparisonArgs({ definition: selectDef }),
};

export const RadioGroup: Story = {
    args: uswdsComparisonArgs({ definition: radioGroupDef }),
};

export const Checkbox: Story = {
    args: uswdsComparisonArgs({ definition: checkboxDef }),
};

export const CheckboxGroup: Story = {
    args: uswdsComparisonArgs({ definition: checkboxGroupDef }),
};

export const NumberInput: Story = {
    args: uswdsComparisonArgs({ definition: numberInputDef }),
};

export const NumberStepper: Story = {
    args: uswdsComparisonArgs({ definition: numberStepperDef }),
};

export const DatePicker: Story = {
    args: uswdsComparisonArgs({ definition: datePickerDef }),
};

export const MoneyInput: Story = {
    args: uswdsComparisonArgs({ definition: moneyInputDef }),
};

export const Toggle: Story = {
    args: uswdsComparisonArgs({ definition: toggleDef }),
};

export const ContactForm: Story = {
    args: uswdsComparisonArgs({ definition: contactFormDef }),
};

export const Display: Story = {
    args: uswdsComparisonArgs({ definition: displayDef }),
};

export const RepeatGroup: Story = {
    args: uswdsComparisonArgs({ definition: repeatGroupDef }),
};

export const Conditional: Story = {
    args: uswdsComparisonArgs({ definition: conditionalDef }),
};

export const Validation: Story = {
    args: uswdsComparisonArgs({
        definition: validationDef,
        componentDocument: validationDemoComponentDoc,
        showSubmit: true,
    }),
};

export const Slider: Story = {
    args: uswdsComparisonArgs({ definition: sliderDef }),
};

export const FileUpload: Story = {
    args: uswdsComparisonArgs({ definition: fileUploadDef }),
};
