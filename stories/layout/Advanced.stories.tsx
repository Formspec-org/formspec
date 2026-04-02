import type { Meta, StoryObj } from '@storybook/react';
import { SideBySideStory } from '../_shared/SideBySideStory';
import { contactFormDef } from '../_shared/definitions';
import {
    collapsibleComponentDoc,
    accordionComponentDoc,
    accordionMultiComponentDoc,
    panelComponentDoc,
    modalComponentDoc,
    popoverComponentDoc,
    wizardComponentDoc,
    wizardWithSidenavComponentDoc,
    tabsComponentDoc,
} from './definitions';

const meta: Meta<typeof SideBySideStory> = {
    title: 'Layout/Advanced',
    component: SideBySideStory,
    args: { showSubmit: false, definition: contactFormDef },
};
export default meta;

type Story = StoryObj<typeof SideBySideStory>;

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

export const WizardWithSidenav: Story = {
    name: 'Wizard (side navigation)',
    args: { showSubmit: true, componentDocument: wizardWithSidenavComponentDoc },
};

export const Tabs: Story = {
    name: 'Tabs',
    args: { componentDocument: tabsComponentDoc },
};
