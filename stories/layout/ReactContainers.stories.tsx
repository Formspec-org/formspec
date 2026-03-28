import type { Meta, StoryObj } from '@storybook/react';
import { FormStory } from '../helpers/FormStory';
import {
    contactFormDef,
    contactFormComponentDoc,
    groupedFormDef,
    groupedFormComponentDoc,
} from '../helpers/definitions';

const meta: Meta<typeof FormStory> = {
    title: 'Layout/React',
    component: FormStory,
    args: { showSubmit: false },  // Layout demos — submission shown in Examples
    parameters: {
        docs: {
            description: {
                component: 'Container layouts rendered via the **React** renderer (`FormspecForm`). Uses the shared layout planner with React component implementations.',
            },
        },
    },
};
export default meta;

type Story = StoryObj<typeof FormStory>;

/** Flat fields — no groups, no component document. */
export const ContactForm: Story = {
    name: 'Contact Form (flat)',
    args: { definition: contactFormDef },
};

/** Same contact form but with a Grid + Card component document. */
export const ContactFormGrid: Story = {
    name: 'Contact Form (Grid + Card)',
    args: { definition: contactFormDef, componentDocument: contactFormComponentDoc },
};

/** Groups rendered with the default fallback planner (Stack). */
export const GroupedForm: Story = {
    name: 'Grouped Form (default)',
    args: { definition: groupedFormDef },
};

/** Same grouped form with a component document wrapping groups in Cards. */
export const CardLayout: Story = {
    name: 'Grouped Form (Card layout)',
    args: { definition: groupedFormDef, componentDocument: groupedFormComponentDoc },
};
