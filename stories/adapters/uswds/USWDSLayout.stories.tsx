/** @filedesc Storybook: USWDS adapter vs real USWDS — layout pattern comparisons. */
import type { Meta, StoryObj } from '@storybook/react';
import { USWDSSideBySideStory } from '../../_shared/USWDSSideBySideStory';
import { uswdsComparisonArgs } from '../../_shared/uswds-comparison-story-args';
import { contactFormDef } from '../../_shared/definitions';
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
} from '../../layout/definitions';

const meta: Meta<typeof USWDSSideBySideStory> = {
    title: 'Adapters/USWDS Layout',
    component: USWDSSideBySideStory,
    parameters: {
        docs: {
            story: { inline: false },
            description: {
                component: 'Compares layout-oriented Formspec USWDS adapter stories against equivalent real USWDS compositions, with each pane isolated in its own shadow root. Story args are built with `uswdsComparisonArgs` so hydration presets stay aligned with `stories/_shared/uswds-comparison-presets.ts` when definitions match.',
            },
        },
    },
};
export default meta;

type Story = StoryObj<typeof USWDSSideBySideStory>;

export const ContactFormGrid: Story = {
    name: 'Contact Form (Grid + Card)',
    args: uswdsComparisonArgs({
        definition: contactFormDef,
        componentDocument: contactFormComponentDoc,
    }),
};

export const GroupedFormCards: Story = {
    name: 'Grouped Form (Card layout)',
    args: uswdsComparisonArgs({
        definition: groupedFormDef,
        componentDocument: groupedFormComponentDoc,
    }),
};

export const Collapsible: Story = {
    args: uswdsComparisonArgs({
        definition: contactFormDef,
        componentDocument: collapsibleComponentDoc,
    }),
};

export const Accordion: Story = {
    args: uswdsComparisonArgs({
        definition: contactFormDef,
        componentDocument: accordionComponentDoc,
    }),
};

export const AccordionMultiOpen: Story = {
    name: 'Accordion (Multi-open)',
    args: uswdsComparisonArgs({
        definition: contactFormDef,
        componentDocument: accordionMultiComponentDoc,
    }),
};

export const Panel: Story = {
    name: 'Panel (Sidebar)',
    args: uswdsComparisonArgs({
        definition: contactFormDef,
        componentDocument: panelComponentDoc,
    }),
};

export const Modal: Story = {
    args: uswdsComparisonArgs({
        definition: contactFormDef,
        componentDocument: modalComponentDoc,
    }),
};

export const Popover: Story = {
    args: uswdsComparisonArgs({
        definition: contactFormDef,
        componentDocument: popoverComponentDoc,
    }),
};

export const Wizard: Story = {
    name: 'Wizard (Multi-step)',
    args: uswdsComparisonArgs({
        definition: contactFormDef,
        componentDocument: wizardComponentDoc,
        showSubmit: true,
    }),
};

export const Tabs: Story = {
    args: uswdsComparisonArgs({
        definition: contactFormDef,
        componentDocument: tabsComponentDoc,
    }),
};
