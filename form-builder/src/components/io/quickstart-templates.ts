import type { FormspecDefinition } from 'formspec-engine';

export interface QuickstartTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  definition: FormspecDefinition;
}

export const QUICKSTART_TEMPLATES: QuickstartTemplate[] = [
  {
    id: 'contact-form',
    name: 'Contact Form',
    description: 'Name, email, phone, message',
    icon: '✉️',
    definition: {
      $formspec: '1.0',
      url: 'https://example.org/forms/contact',
      version: '1.0.0',
      status: 'draft',
      title: 'Contact Form',
      description: 'Get in touch with us.',
      items: [
        { type: 'field', key: 'name', dataType: 'string', label: 'Full name' },
        { type: 'field', key: 'email', dataType: 'string', label: 'Email address' },
        { type: 'field', key: 'phone', dataType: 'string', label: 'Phone number' },
        { type: 'field', key: 'message', dataType: 'text', label: 'Message' }
      ],
      binds: [
        { path: 'name', required: true },
        { path: 'email', required: true },
        { path: 'message', required: true }
      ]
    }
  },
  {
    id: 'survey',
    name: 'Survey',
    description: 'Satisfaction rating and feedback',
    icon: '📊',
    definition: {
      $formspec: '1.0',
      url: 'https://example.org/forms/survey',
      version: '1.0.0',
      status: 'draft',
      title: 'Feedback Survey',
      description: 'Share your experience.',
      items: [
        {
          type: 'field',
          key: 'overallSatisfaction',
          dataType: 'integer',
          label: 'Overall satisfaction',
          presentation: { widgetHint: 'Rating' }
        },
        {
          type: 'field',
          key: 'recommend',
          dataType: 'boolean',
          label: 'Would you recommend us?',
          presentation: { widgetHint: 'Toggle' }
        },
        {
          type: 'field',
          key: 'improvements',
          dataType: 'text',
          label: 'What could we improve?'
        },
        {
          type: 'field',
          key: 'comments',
          dataType: 'text',
          label: 'Additional comments'
        }
      ],
      binds: [
        { path: 'overallSatisfaction', required: true }
      ]
    }
  },
  {
    id: 'registration',
    name: 'Registration',
    description: 'Event or program sign-up',
    icon: '📋',
    definition: {
      $formspec: '1.0',
      url: 'https://example.org/forms/registration',
      version: '1.0.0',
      status: 'draft',
      title: 'Event Registration',
      description: 'Register for the event.',
      items: [
        {
          type: 'group',
          key: 'personalInfo',
          label: 'Personal Information',
          children: [
            { type: 'field', key: 'firstName', dataType: 'string', label: 'First name' },
            { type: 'field', key: 'lastName', dataType: 'string', label: 'Last name' },
            { type: 'field', key: 'email', dataType: 'string', label: 'Email address' },
            { type: 'field', key: 'phone', dataType: 'string', label: 'Phone number' }
          ]
        },
        {
          type: 'group',
          key: 'eventDetails',
          label: 'Event Details',
          children: [
            {
              type: 'field',
              key: 'session',
              dataType: 'choice',
              label: 'Preferred session',
              options: [
                { value: 'morning', label: 'Morning (9am – 12pm)' },
                { value: 'afternoon', label: 'Afternoon (1pm – 4pm)' },
                { value: 'evening', label: 'Evening (5pm – 8pm)' }
              ]
            },
            {
              type: 'field',
              key: 'dietary',
              dataType: 'multiChoice',
              label: 'Dietary requirements',
              options: [
                { value: 'vegetarian', label: 'Vegetarian' },
                { value: 'vegan', label: 'Vegan' },
                { value: 'glutenFree', label: 'Gluten-free' },
                { value: 'none', label: 'None' }
              ]
            },
            { type: 'field', key: 'agreeTerms', dataType: 'boolean', label: 'I agree to the terms and conditions' }
          ]
        }
      ],
      binds: [
        { path: 'personalInfo.firstName', required: true },
        { path: 'personalInfo.lastName', required: true },
        { path: 'personalInfo.email', required: true },
        { path: 'eventDetails.session', required: true },
        { path: 'eventDetails.agreeTerms', required: true }
      ]
    }
  },
  {
    id: 'grant-application',
    name: 'Grant Application',
    description: 'Organization details and project proposal',
    icon: '🏛️',
    definition: {
      $formspec: '1.0',
      url: 'https://example.org/forms/grant-application',
      version: '1.0.0',
      status: 'draft',
      title: 'Grant Application',
      description: 'Apply for funding.',
      items: [
        {
          type: 'group',
          key: 'organization',
          label: 'Organization',
          children: [
            { type: 'field', key: 'orgName', dataType: 'string', label: 'Organization name' },
            {
              type: 'field',
              key: 'orgType',
              dataType: 'choice',
              label: 'Organization type',
              options: [
                { value: 'nonprofit', label: 'Nonprofit' },
                { value: 'university', label: 'University / Research institution' },
                { value: 'government', label: 'Government agency' },
                { value: 'other', label: 'Other' }
              ]
            },
            { type: 'field', key: 'taxId', dataType: 'string', label: 'Tax ID / EIN' },
            { type: 'field', key: 'website', dataType: 'uri', label: 'Website' }
          ]
        },
        {
          type: 'group',
          key: 'project',
          label: 'Project Proposal',
          children: [
            { type: 'field', key: 'projectTitle', dataType: 'string', label: 'Project title' },
            { type: 'field', key: 'summary', dataType: 'text', label: 'Project summary' },
            { type: 'field', key: 'budget', dataType: 'money', label: 'Requested amount' },
            { type: 'field', key: 'startDate', dataType: 'date', label: 'Project start date' },
            { type: 'field', key: 'endDate', dataType: 'date', label: 'Project end date' },
            { type: 'field', key: 'outcomes', dataType: 'text', label: 'Expected outcomes' }
          ]
        },
        {
          type: 'group',
          key: 'contact',
          label: 'Primary Contact',
          children: [
            { type: 'field', key: 'contactName', dataType: 'string', label: 'Contact name' },
            { type: 'field', key: 'contactEmail', dataType: 'string', label: 'Contact email' },
            { type: 'field', key: 'contactPhone', dataType: 'string', label: 'Contact phone' }
          ]
        }
      ],
      binds: [
        { path: 'organization.orgName', required: true },
        { path: 'organization.orgType', required: true },
        { path: 'project.projectTitle', required: true },
        { path: 'project.summary', required: true },
        { path: 'project.budget', required: true },
        { path: 'contact.contactName', required: true },
        { path: 'contact.contactEmail', required: true }
      ]
    }
  }
];
