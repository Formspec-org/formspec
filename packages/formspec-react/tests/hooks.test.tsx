/** @filedesc Tests for formspec-react hooks: useSignal, useField, useFieldValue, useFieldError, useForm, useWhen, useRepeatCount. */
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { signal, computed } from '@preact/signals-core';
import { createFormEngine, initFormspecEngine } from 'formspec-engine';
import { useSignal } from '../src/use-signal';
import { FormspecProvider, useFormspecContext } from '../src/context';
import { useField } from '../src/use-field';
import { useFieldValue } from '../src/use-field-value';
import { useFieldError } from '../src/use-field-error';
import { useForm } from '../src/use-form';
import { useWhen } from '../src/use-when';
import { useRepeatCount } from '../src/use-repeat-count';

beforeAll(async () => {
    await initFormspecEngine();
});

// ── Test helpers ──────────────────────────────────────────────────

function renderHook<T>(hookFn: () => T): { result: { current: T }; container: HTMLElement } {
    const result = { current: null as T };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestComponent() {
        result.current = hookFn();
        return null;
    }

    flushSync(() => { root.render(<TestComponent />); });

    return { result, container };
}

function renderHookWithProvider<T>(
    definition: any,
    hookFn: () => T,
): { result: { current: T }; container: HTMLElement } {
    const result = { current: null as T };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestComponent() {
        result.current = hookFn();
        return null;
    }

    flushSync(() => {
        root.render(
            <FormspecProvider definition={definition}>
                <TestComponent />
            </FormspecProvider>
        );
    });

    return { result, container };
}

// Minimal definition for testing
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
            hint: 'Enter your full name.',
        },
        {
            key: 'age',
            type: 'field',
            dataType: 'integer',
            label: 'Age',
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

// ── useSignal ──────────────────────────────────────────────────────

describe('useSignal', () => {
    it('reads the current signal value', () => {
        const sig = signal(42);
        const { result } = renderHook(() => useSignal(sig));
        expect(result.current).toBe(42);
    });

    it('reads computed signal values', () => {
        const base = signal(10);
        const doubled = computed(() => base.value * 2);
        const { result } = renderHook(() => useSignal(doubled));
        expect(result.current).toBe(20);
    });
});

// ── useField ───────────────────────────────────────────────────────

describe('useField', () => {
    it('returns full field state for a string field', () => {
        const { result } = renderHookWithProvider(testDefinition, () => useField('name'));

        expect(result.current.id).toBeTruthy();
        expect(result.current.label).toBe('Full Name');
        expect(result.current.hint).toBe('Enter your full name.');
        expect(result.current.dataType).toBe('string');
        expect(result.current.required).toBe(true);
        // Engine initializes string fields to '' (empty string)
        expect(result.current.value).toBe('');
        expect(result.current.visible).toBe(true);
        expect(result.current.readonly).toBe(false);
    });

    it('returns inputProps spread helper', () => {
        const { result } = renderHookWithProvider(testDefinition, () => useField('name'));
        const props = result.current.inputProps;

        expect(props.id).toBeTruthy();
        expect(props.name).toBeTruthy();
        expect(props.required).toBe(true);
        expect(props.readOnly).toBe(false);
        expect(typeof props.onChange).toBe('function');
    });

    it('provides setValue function', () => {
        const { result } = renderHookWithProvider(testDefinition, () => useField('name'));
        expect(typeof result.current.setValue).toBe('function');
    });
});

// ── useFieldValue ──────────────────────────────────────────────────

describe('useFieldValue', () => {
    it('returns value and setValue', () => {
        const { result } = renderHookWithProvider(testDefinition, () => useFieldValue('name'));
        // Engine initializes string fields to '' (empty string)
        expect(result.current.value).toBe('');
        expect(typeof result.current.setValue).toBe('function');
    });
});

// ── useFieldError ──────────────────────────────────────────────────

describe('useFieldError', () => {
    it('returns null when no error', () => {
        const { result } = renderHookWithProvider(testDefinition, () => useFieldError('age'));
        expect(result.current).toBe(null);
    });
});

// ── useForm ────────────────────────────────────────────────────────

describe('useForm', () => {
    it('returns form-level state', () => {
        const { result } = renderHookWithProvider(testDefinition, () => useForm());
        expect(result.current.title).toBe('Test Form');
        expect(result.current.description).toBe('A test form.');
        expect(typeof result.current.isValid).toBe('boolean');
        expect(typeof result.current.submit).toBe('function');
        expect(typeof result.current.getResponse).toBe('function');
    });

    it('submit returns response and validation report', () => {
        const { result } = renderHookWithProvider(testDefinition, () => useForm());
        const detail = result.current.submit({ mode: 'submit' });
        expect(detail).toHaveProperty('response');
        expect(detail).toHaveProperty('validationReport');
        expect(detail.validationReport).toHaveProperty('valid');
    });
});

// ── FormspecProvider ───────────────────────────────────────────────

describe('FormspecProvider', () => {
    it('throws if no engine or definition provided', () => {
        // React catches render errors — verify via console.error spy
        const errors: any[] = [];
        const origError = console.error;
        console.error = (...args: any[]) => errors.push(args);
        try {
            const container = document.createElement('div');
            const root = createRoot(container);
            flushSync(() => {
                root.render(
                    <FormspecProvider>
                        <div />
                    </FormspecProvider>
                );
            });
        } catch {
            // expected
        } finally {
            console.error = origError;
        }
        const errorMessages = errors.map(a => String(a)).join(' ');
        expect(errorMessages).toContain('requires either engine or definition');
    });

    it('accepts a pre-built engine', () => {
        const engine = createFormEngine(testDefinition);
        const { result } = (() => {
            const result = { current: null as any };
            const container = document.createElement('div');
            const root = createRoot(container);
            function Inner() {
                result.current = useForm();
                return null;
            }
            flushSync(() => {
                root.render(
                    <FormspecProvider engine={engine}>
                        <Inner />
                    </FormspecProvider>
                );
            });
            return { result, container };
        })();

        expect(result.current.title).toBe('Test Form');
    });
});

// ── useWhen ──────────────────────────────────────────────────────

const whenDefinition = {
    $formspec: '1.0',
    url: 'https://test.example/when',
    version: '1.0.0',
    status: 'active',
    title: 'When Test',
    name: 'when-test',
    items: [
        { key: 'toggle', type: 'field', dataType: 'boolean', label: 'Toggle' },
        { key: 'text', type: 'field', dataType: 'string', label: 'Text' },
    ],
};

function renderHookWithEngine<T>(
    engine: any,
    hookFn: () => T,
): { result: { current: T }; container: HTMLElement } {
    const result = { current: null as T };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestComponent() {
        result.current = hookFn();
        return null;
    }

    flushSync(() => {
        root.render(
            <FormspecProvider engine={engine}>
                <TestComponent />
            </FormspecProvider>
        );
    });

    return { result, container };
}

describe('useWhen', () => {
    it('returns false when the expression evaluates to falsy', () => {
        const engine = createFormEngine(whenDefinition);
        // toggle starts as false
        const { result } = renderHookWithEngine(engine, () => useWhen('$toggle'));
        expect(result.current).toBe(false);
    });

    it('returns true when the expression evaluates to truthy', () => {
        const engine = createFormEngine(whenDefinition);
        engine.setValue('toggle', true);
        const { result } = renderHookWithEngine(engine, () => useWhen('$toggle'));
        expect(result.current).toBe(true);
    });
});

// ── useRepeatCount ───────────────────────────────────────────────

const repeatDefinition = {
    $formspec: '1.0',
    url: 'https://test.example/repeat',
    version: '1.0.0',
    status: 'active',
    title: 'Repeat Test',
    name: 'repeat-test',
    items: [
        {
            key: 'items',
            type: 'group',
            label: 'Items',
            repeatable: true,
            children: [
                { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
            ],
        },
    ],
};

describe('useRepeatCount', () => {
    it('returns initial repeat count (minRepeat defaults to 1)', () => {
        const engine = createFormEngine(repeatDefinition);
        const { result } = renderHookWithEngine(engine, () => useRepeatCount('items'));
        expect(result.current).toBe(1);
    });

    it('returns 0 for non-existent repeat path', () => {
        const engine = createFormEngine(repeatDefinition);
        const { result } = renderHookWithEngine(engine, () => useRepeatCount('nonexistent'));
        expect(result.current).toBe(0);
    });
});

// ── Touched tracking ─────────────────────────────────────────────

describe('useField touched tracking', () => {
    it('field starts untouched', () => {
        const { result } = renderHookWithProvider(testDefinition, () => useField('name'));
        expect(result.current.touched).toBe(false);
    });

    it('inputProps.onBlur marks field as touched', () => {
        const { result } = renderHookWithProvider(testDefinition, () => useField('name'));
        expect(result.current.touched).toBe(false);
        expect(typeof result.current.inputProps.onBlur).toBe('function');
    });

    it('field becomes touched after touchField is called', () => {
        const engine = createFormEngine(testDefinition);
        const result = { current: null as any };
        const touchResult = { current: null as any };
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        function Inner() {
            result.current = useField('name');
            const ctx = useFormspecContext();
            touchResult.current = ctx;
            return null;
        }

        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <Inner />
                </FormspecProvider>
            );
        });

        expect(result.current.touched).toBe(false);

        // Touch the field
        flushSync(() => {
            touchResult.current.touchField('name');
        });

        expect(result.current.touched).toBe(true);
    });
});
