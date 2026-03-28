import type { Meta, StoryObj } from '@storybook/react';
import { SideBySideStory } from '../_shared/SideBySideStory';
import { FormStory } from '../_shared/FormStory';
import definition from '../../examples/react-demo/src/definition.json';
import theme from '../../examples/react-demo/src/theme.json';

const meta: Meta<typeof SideBySideStory> = {
    title: 'Examples/Grant Application',
    component: SideBySideStory,
    parameters: {
        docs: {
            description: {
                component: 'Community Impact Grant form from `examples/react-demo/`. Rendered side-by-side through React and Web Component renderers.',
            },
        },
    },
};
export default meta;

type Story = StoryObj<typeof SideBySideStory>;

export const Default: Story = {
    name: 'Community Impact Grant',
    args: { definition, theme },
};

/** Pre-filled (React only — Web Component does not support initialData). */
export const PreFilled: Story = {
    name: 'Pre-filled (React)',
    render: () => (
        <FormStory
            definition={definition}
            theme={theme}
            initialData={{
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
            }}
        />
    ),
};
