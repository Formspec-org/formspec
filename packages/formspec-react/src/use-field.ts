/** @filedesc useField — full reactive field state from FieldViewModel. */
import { useMemo } from 'react';
import type { FieldViewModel, ResolvedOption, ResolvedValidationResult } from 'formspec-engine';
import { useFormspecContext } from './context';
import { useSignal } from './use-signal';

export interface UseFieldResult {
    // Identity
    id: string;
    path: string;
    itemKey: string;
    dataType: string;

    // Presentation (reactive)
    label: string;
    hint: string | null;
    description: string | null;

    // State (reactive)
    value: any;
    required: boolean;
    visible: boolean;
    readonly: boolean;

    // Validation (reactive)
    errors: ResolvedValidationResult[];
    error: string | null;

    // Options (reactive, for choice fields)
    options: ResolvedOption[];
    optionsState: { loading: boolean; error: string | null };

    // Write
    setValue(value: any): void;

    // Props spread helper — spread onto any <input>-like component
    inputProps: {
        id: string;
        name: string;
        value: any;
        onChange: (e: { target: { value: any } }) => void;
        required: boolean;
        readOnly: boolean;
        'aria-invalid': boolean;
        'aria-required': boolean;
    };
}

/**
 * Full field state from a FieldViewModel.
 * Re-renders when any signal on the VM changes.
 * For finer-grained subscriptions, use useFieldValue/useFieldError.
 */
export function useField(path: string): UseFieldResult {
    const { engine } = useFormspecContext();

    const vm = useMemo(() => {
        const fieldVM = engine.getFieldVM(path);
        if (!fieldVM) throw new Error(`No FieldViewModel for path "${path}". Is the field defined?`);
        return fieldVM;
    }, [engine, path]);

    const label = useSignal(vm.label);
    const hint = useSignal(vm.hint);
    const description = useSignal(vm.description);
    const value = useSignal(vm.value);
    const required = useSignal(vm.required);
    const visible = useSignal(vm.visible);
    const readonly = useSignal(vm.readonly);
    const errors = useSignal(vm.errors);
    const firstError = useSignal(vm.firstError);
    const options = useSignal(vm.options);
    const optionsState = useSignal(vm.optionsState);

    const inputProps = useMemo(() => ({
        id: vm.id,
        name: vm.instancePath,
        value: value ?? '',
        onChange: (e: { target: { value: any } }) => vm.setValue(e.target.value),
        required,
        readOnly: readonly,
        'aria-invalid': !!firstError,
        'aria-required': required,
    }), [vm, value, required, readonly, firstError]);

    return {
        id: vm.id,
        path: vm.instancePath,
        itemKey: vm.itemKey,
        dataType: vm.dataType,
        label,
        hint,
        description,
        value,
        required,
        visible,
        readonly,
        errors,
        error: firstError,
        options,
        optionsState,
        setValue: vm.setValue,
        inputProps,
    };
}
