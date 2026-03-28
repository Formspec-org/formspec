import type { Meta, StoryObj } from '@storybook/react';
import { SideBySideStory } from '../_shared/SideBySideStory';
import { contactFormDef } from '../_shared/definitions';
import {
    groupedFormDef,
    contactFormComponentDoc,
    groupedFormComponentDoc,
} from './definitions';

const meta: Meta<typeof SideBySideStory> = {
    title: 'Layout/Containers',
    component: SideBySideStory,
    args: { showSubmit: false },
};
export default meta;

type Story = StoryObj<typeof SideBySideStory>;

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
