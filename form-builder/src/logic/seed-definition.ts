import type { FormspecDefinition } from 'formspec-engine';

export function createEmptyDefinition(): FormspecDefinition {
    return {
        $formspec: '1.0',
        url: 'https://example.gov/forms/untitled',
        version: '0.1.0',
        status: 'draft',
        title: 'Untitled Form',
        items: [
            {
                key: 'basicInfo',
                type: 'group',
                label: 'Basic Information',
                children: [
                    { key: 'fullName', type: 'field', label: 'Full Name', dataType: 'string' },
                    { key: 'email', type: 'field', label: 'Email Address', dataType: 'string' },
                ],
            },
            { key: 'notes', type: 'field', label: 'Additional Notes', dataType: 'text' },
        ],
    } as FormspecDefinition;
}

/** Pre-built templates for the empty state quick-start */
export const FORM_TEMPLATES: { id: string; icon: string; label: string; desc: string; factory: () => FormspecDefinition }[] = [
    {
        id: 'blank',
        icon: '📄',
        label: 'Blank Form',
        desc: 'Start fresh',
        factory: () => ({
            $formspec: '1.0',
            url: 'https://example.gov/forms/new',
            version: '0.1.0',
            status: 'draft',
            title: 'New Form',
            items: [],
        } as FormspecDefinition),
    },
    {
        id: 'contact',
        icon: '📨',
        label: 'Contact Form',
        desc: 'Name, email, message',
        factory: () => ({
            $formspec: '1.0',
            url: 'https://example.gov/forms/contact',
            version: '0.1.0',
            status: 'draft',
            title: 'Contact Us',
            items: [
                { key: 'name', type: 'field', label: 'Full Name', dataType: 'string' },
                { key: 'email', type: 'field', label: 'Email', dataType: 'string' },
                { key: 'subject', type: 'field', label: 'Subject', dataType: 'string' },
                { key: 'message', type: 'field', label: 'Message', dataType: 'text' },
            ],
        } as FormspecDefinition),
    },
    {
        id: 'survey',
        icon: '📊',
        label: 'Survey',
        desc: 'Questions with choices',
        factory: () => ({
            $formspec: '1.0',
            url: 'https://example.gov/forms/survey',
            version: '0.1.0',
            status: 'draft',
            title: 'Customer Survey',
            items: [
                {
                    key: 'aboutYou',
                    type: 'group',
                    label: 'About You',
                    children: [
                        { key: 'name', type: 'field', label: 'Your Name', dataType: 'string' },
                        {
                            key: 'role', type: 'field', label: 'Your Role', dataType: 'choice', options: [
                                { value: 'developer', label: 'Developer' },
                                { value: 'designer', label: 'Designer' },
                                { value: 'manager', label: 'Manager' },
                                { value: 'other', label: 'Other' },
                            ]
                        },
                    ],
                },
                {
                    key: 'feedback',
                    type: 'group',
                    label: 'Feedback',
                    children: [
                        { key: 'rating', type: 'field', label: 'Overall Rating', dataType: 'integer' },
                        { key: 'recommend', type: 'field', label: 'Would Recommend?', dataType: 'boolean' },
                        { key: 'comments', type: 'field', label: 'Comments', dataType: 'text' },
                    ],
                },
            ],
        } as FormspecDefinition),
    },
    {
        id: 'registration',
        icon: '🪪',
        label: 'Registration',
        desc: 'User signup form',
        factory: () => ({
            $formspec: '1.0',
            url: 'https://example.gov/forms/register',
            version: '0.1.0',
            status: 'draft',
            title: 'Registration Form',
            items: [
                {
                    key: 'personal',
                    type: 'group',
                    label: 'Personal Information',
                    children: [
                        { key: 'firstName', type: 'field', label: 'First Name', dataType: 'string' },
                        { key: 'lastName', type: 'field', label: 'Last Name', dataType: 'string' },
                        { key: 'dob', type: 'field', label: 'Date of Birth', dataType: 'date' },
                        { key: 'email', type: 'field', label: 'Email', dataType: 'string' },
                    ],
                },
                {
                    key: 'account',
                    type: 'group',
                    label: 'Account Details',
                    children: [
                        { key: 'username', type: 'field', label: 'Username', dataType: 'string' },
                        { key: 'agreeTerms', type: 'field', label: 'I agree to terms', dataType: 'boolean' },
                    ],
                },
            ],
        } as FormspecDefinition),
    },
];
