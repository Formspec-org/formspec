import type { Meta, StoryObj } from '@storybook/react';
import { SideBySideStory } from '../_shared/SideBySideStory';
import { fileUploadDef, toggleDef, signatureDef } from './definitions';

const meta: Meta<typeof SideBySideStory> = {
    title: 'Fields/Special',
    component: SideBySideStory,
};
export default meta;

type Story = StoryObj<typeof SideBySideStory>;

export const FileUpload: Story = {
    args: { definition: fileUploadDef },
};

export const Toggle: Story = {
    args: { definition: toggleDef },
};

export const Signature: Story = {
    args: { definition: signatureDef },
};
