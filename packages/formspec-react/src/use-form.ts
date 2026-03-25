/** @filedesc useForm — form-level reactive state (title, validity, submit). */
import { useMemo, useCallback } from 'react';
import { useFormspecContext } from './context';
import { useSignal } from './use-signal';

export interface UseFormResult {
    title: string;
    description: string;
    isValid: boolean;
    validationSummary: { errors: number; warnings: number; infos: number };
    submit(options?: { mode?: 'continuous' | 'submit' }): any;
    getResponse(meta?: Record<string, any>): any;
}

/**
 * Form-level state from FormViewModel.
 * Provides title, validity, and submit/response access.
 */
export function useForm(): UseFormResult {
    const { engine } = useFormspecContext();

    const formVM = useMemo(() => engine.getFormVM(), [engine]);

    const title = useSignal(formVM.title);
    const description = useSignal(formVM.description);
    const isValid = useSignal(formVM.isValid);
    const validationSummary = useSignal(formVM.validationSummary);

    const submit = useCallback((options?: { mode?: 'continuous' | 'submit' }) => {
        const report = engine.getValidationReport(options);
        const response = engine.getResponse({ mode: options?.mode });
        return { response, validationReport: report };
    }, [engine]);

    const getResponse = useCallback((meta?: Record<string, any>) => {
        return engine.getResponse(meta);
    }, [engine]);

    return {
        title,
        description,
        isValid,
        validationSummary,
        submit,
        getResponse,
    };
}
