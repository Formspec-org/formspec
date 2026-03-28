import type { Meta, StoryObj } from '@storybook/react';
import { FormStory } from '../helpers/FormStory';
import {
    contactFormDef,
    collapsibleComponentDoc,
    accordionComponentDoc,
    accordionMultiComponentDoc,
    panelComponentDoc,
    modalComponentDoc,
    popoverComponentDoc,
    wizardComponentDoc,
    tabsComponentDoc,
} from '../helpers/definitions';

const meta: Meta<typeof FormStory> = {
    title: 'Layout/Advanced',
    component: FormStory,
    args: { showSubmit: false, definition: contactFormDef },
};
export default meta;

type Story = StoryObj<typeof FormStory>;

export const Collapsible: Story = {
    name: 'Collapsible',
    args: { componentDocument: collapsibleComponentDoc },
};

export const Accordion: Story = {
    name: 'Accordion',
    args: { componentDocument: accordionComponentDoc },
};

export const AccordionMultiOpen: Story = {
    name: 'Accordion (Multi-open)',
    args: { componentDocument: accordionMultiComponentDoc },
};

export const Panel: Story = {
    name: 'Panel (Sidebar)',
    args: { componentDocument: panelComponentDoc },
};

export const Modal: Story = {
    name: 'Modal',
    args: { componentDocument: modalComponentDoc },
};

export const Popover: Story = {
    name: 'Popover',
    args: { componentDocument: popoverComponentDoc },
};

export const Wizard: Story = {
    name: 'Wizard (Multi-step)',
    args: { showSubmit: true, componentDocument: wizardComponentDoc },
};

export const Tabs: Story = {
    name: 'Tabs',
    args: { componentDocument: tabsComponentDoc },
};
