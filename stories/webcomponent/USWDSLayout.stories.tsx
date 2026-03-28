import type { Meta, StoryObj } from '@storybook/react';
import { USWDSSideBySideStory } from '../_shared/USWDSSideBySideStory';
import { contactFormDef } from '../_shared/definitions';
import {
    groupedFormDef,
    contactFormComponentDoc,
    groupedFormComponentDoc,
    collapsibleComponentDoc,
    accordionComponentDoc,
    accordionMultiComponentDoc,
    panelComponentDoc,
    modalComponentDoc,
    popoverComponentDoc,
    wizardComponentDoc,
    tabsComponentDoc,
} from '../layout/definitions';

const meta: Meta<typeof USWDSSideBySideStory> = {
    title: 'Adapters/USWDS Layout',
    component: USWDSSideBySideStory,
    parameters: {
        docs: {
            story: { inline: false },
            description: {
                component: 'Compares layout-oriented Formspec USWDS adapter stories against equivalent real USWDS compositions, with each pane isolated in its own shadow root.',
            },
        },
    },
};
export default meta;

type Story = StoryObj<typeof USWDSSideBySideStory>;

const withComparison = (definition: any, componentDocument?: any, showSubmit = false) => ({
    definition,
    componentDocument,
    showSubmit,
    maxWidth: 1400,
});

export const ContactFormGrid: Story = {
    name: 'Contact Form (Grid + Card)',
    args: withComparison(contactFormDef, contactFormComponentDoc),
};

export const GroupedFormCards: Story = {
    name: 'Grouped Form (Card layout)',
    args: withComparison(groupedFormDef, groupedFormComponentDoc),
};

export const Collapsible: Story = {
    args: withComparison(contactFormDef, collapsibleComponentDoc),
};

export const Accordion: Story = {
    args: withComparison(contactFormDef, accordionComponentDoc),
};

export const AccordionMultiOpen: Story = {
    name: 'Accordion (Multi-open)',
    args: withComparison(contactFormDef, accordionMultiComponentDoc),
};

export const Panel: Story = {
    name: 'Panel (Sidebar)',
    args: withComparison(contactFormDef, panelComponentDoc),
};

export const Modal: Story = {
    args: withComparison(contactFormDef, modalComponentDoc),
};

export const Popover: Story = {
    args: withComparison(contactFormDef, popoverComponentDoc),
};

export const Wizard: Story = {
    name: 'Wizard (Multi-step)',
    args: withComparison(contactFormDef, wizardComponentDoc, true),
};

export const Tabs: Story = {
    args: withComparison(contactFormDef, tabsComponentDoc),
};
