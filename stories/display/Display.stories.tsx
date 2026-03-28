import type { Meta, StoryObj } from '@storybook/react';
import { FormStory } from '../helpers/FormStory';
import {
    allDisplayDef,
    contactFormDef,
    alertVariantsComponentDoc,
    headingHierarchyComponentDoc,
    badgeSpacerComponentDoc,
    progressBarComponentDoc,
    summaryComponentDoc,
    validationSummaryDef,
    validationSummaryComponentDoc,
    dataTableDef,
    dataTableComponentDoc,
} from '../helpers/definitions';

const meta: Meta<typeof FormStory> = {
    title: 'Display/Components',
    component: FormStory,
    args: { showSubmit: false },
};
export default meta;

type Story = StoryObj<typeof FormStory>;

/** Heading, Text (paragraph), Divider, and Alert (banner) in one form. */
export const AllDisplayTypes: Story = {
    name: 'Heading / Text / Divider / Alert',
    args: { definition: allDisplayDef },
};

/** Alert severity variants: info, success, warning, error + dismissible. */
export const AlertVariants: Story = {
    name: 'Alert Variants',
    args: { definition: contactFormDef, componentDocument: alertVariantsComponentDoc },
};

/** Heading h1–h6 hierarchy. */
export const HeadingHierarchy: Story = {
    name: 'Heading Hierarchy (h1–h6)',
    args: { definition: contactFormDef, componentDocument: headingHierarchyComponentDoc },
};

/** Badge and Spacer — placed via component document. */
export const BadgeAndSpacer: Story = {
    name: 'Badge & Spacer',
    args: { definition: contactFormDef, componentDocument: badgeSpacerComponentDoc },
};

/** ProgressBar — static value with percentage display. */
export const ProgressBar: Story = {
    name: 'ProgressBar',
    args: { definition: contactFormDef, componentDocument: progressBarComponentDoc },
};

/** Summary — reactive field value display. */
export const Summary: Story = {
    name: 'Summary',
    args: { definition: contactFormDef, componentDocument: summaryComponentDoc },
};

/** ValidationSummary — live validation error list. */
export const ValidationSummary: Story = {
    name: 'ValidationSummary',
    args: { definition: validationSummaryDef, componentDocument: validationSummaryComponentDoc, showSubmit: true },
};

/** DataTable — tabular editing of a repeatable group. */
export const DataTable: Story = {
    name: 'DataTable',
    args: { definition: dataTableDef, componentDocument: dataTableComponentDoc },
};
