import type { Meta, StoryObj } from '@storybook/react';
import { FormStory } from '../helpers/FormStory';
import definition from '../../examples/react-demo/src/definition.json';
import theme from '../../examples/react-demo/src/theme.json';

const meta: Meta<typeof FormStory> = {
    title: 'Forms/Grant Application',
    component: FormStory,
};
export default meta;

type Story = StoryObj<typeof FormStory>;

export const Default: Story = {
    name: 'Community Impact Grant',
    args: {
        definition,
        theme,
    },
};

export const WithInitialData: Story = {
    name: 'Pre-filled',
    args: {
        definition,
        theme,
        initialData: {
            organization: {
                orgName: 'Riverside Community Center',
                orgType: 'nonprofit',
                ein: '12-3456789',
                yearFounded: 1998,
            },
            contact: {
                contactName: 'Jane Smith',
                contactEmail: 'jane@riverside.org',
                contactPhone: '(555) 234-5678',
                state: 'CA',
            },
            project: {
                projectTitle: 'Youth STEM Mentorship Initiative',
                focusArea: 'education',
                summary: 'A 12-month after-school program pairing underserved middle school students with local STEM professionals for weekly mentorship, hands-on labs, and college readiness workshops.',
            },
        },
    },
};
