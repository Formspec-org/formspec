/** @filedesc Tests for FormspecForm auto-renderer and default components. */
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { initFormspecEngine } from 'formspec-engine';
import { FormspecForm } from '../src/renderer';
import type { FieldComponentProps } from '../src/component-map';

beforeAll(async () => {
    await initFormspecEngine();
});

const testDefinition = {
    $formspec: '1.0',
    url: 'https://test.example/form',
    version: '1.0.0',
    status: 'active',
    title: 'Test Form',
    description: 'A test form.',
    name: 'test',
    items: [
        {
            key: 'name',
            type: 'field',
            dataType: 'string',
            label: 'Full Name',
            hint: 'Enter your name.',
        },
        {
            key: 'color',
            type: 'field',
            dataType: 'choice',
            label: 'Favorite Color',
            options: [
                { value: 'red', label: 'Red' },
                { value: 'blue', label: 'Blue' },
            ],
        },
        {
            key: 'agree',
            type: 'field',
            dataType: 'boolean',
            label: 'I agree',
        },
    ],
    binds: [
        { path: 'name', required: 'true' },
    ],
};

function renderInto(element: React.ReactElement): HTMLElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() => { root.render(element); });
    return container;
}

// ── FormspecForm auto-renderer ─────────────────────────────────────

describe('FormspecForm', () => {
    it('renders all fields from definition', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );

        // Should find labels for all 3 fields
        const labels = Array.from(container.querySelectorAll('label'));
        const labelTexts = labels.map(l => l.textContent?.replace(/\s*\*$/, '').trim());
        expect(labelTexts).toContain('Full Name');
        expect(labelTexts).toContain('Favorite Color');
        expect(labelTexts).toContain('I agree');
    });

    it('renders text input for string field', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );
        const input = container.querySelector('input[type="text"]');
        expect(input).toBeTruthy();
    });

    it('renders select for choice field', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );
        const select = container.querySelector('select');
        expect(select).toBeTruthy();
        const options = select!.querySelectorAll('option');
        // placeholder + 2 options = 3
        expect(options.length).toBe(3);
    });

    it('renders checkbox for boolean field', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );
        const checkbox = container.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeTruthy();
    });

    it('renders hint text', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );
        expect(container.textContent).toContain('Enter your name.');
    });

    it('shows required indicator', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );
        // Required fields get a * indicator
        const reqSpans = container.querySelectorAll('[aria-hidden="true"]');
        const starTexts = Array.from(reqSpans).map(s => s.textContent?.trim());
        expect(starTexts).toContain('*');
    });

    it('accepts a className prop on root', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} className="my-form" />
        );
        expect(container.querySelector('.my-form')).toBeTruthy();
    });
});

// ── Component map overrides ────────────────────────────────────────

describe('component map overrides', () => {
    it('uses custom field component when provided', () => {
        const CustomTextInput = ({ field, node }: FieldComponentProps) => (
            <div data-testid="custom-text">{field.label}</div>
        );

        const container = renderInto(
            <FormspecForm
                definition={testDefinition}
                components={{ fields: { TextInput: CustomTextInput } }}
            />
        );

        expect(container.querySelector('[data-testid="custom-text"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="custom-text"]')!.textContent).toBe('Full Name');
    });

    it('falls back to default for non-overridden components', () => {
        const CustomTextInput = ({ field }: FieldComponentProps) => (
            <div data-testid="custom">{field.label}</div>
        );

        const container = renderInto(
            <FormspecForm
                definition={testDefinition}
                components={{ fields: { TextInput: CustomTextInput } }}
            />
        );

        // Select should still render with default (has <select> element)
        expect(container.querySelector('select')).toBeTruthy();
    });
});
