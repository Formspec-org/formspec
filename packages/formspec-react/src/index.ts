/** @filedesc formspec-react — React hooks, auto-renderer, and default components for Formspec. */

// ── Hooks (re-exported from hooks barrel) ──
export { FormspecProvider, useFormspecContext } from './context';
export type { FormspecProviderProps, FormspecContextValue, SubmitResult } from './context';
export { useSignal } from './use-signal';
export { useField } from './use-field';
export type { UseFieldResult } from './use-field';
export { useFieldValue } from './use-field-value';
export type { UseFieldValueResult } from './use-field-value';
export { useFieldError } from './use-field-error';
export { useForm } from './use-form';
export type { UseFormResult, SubmitOptions } from './use-form';
export { useWhen } from './use-when';
export { useRepeatCount } from './use-repeat-count';
export { useLocale } from './use-locale';
export type { UseLocaleResult } from './use-locale';
export { useExternalValidation } from './use-external-validation';
export type { UseExternalValidationResult, ExternalValidationEntry } from './use-external-validation';

// ── Component map types ──
export type { FieldComponentProps, LayoutComponentProps, ComponentMap } from './component-map';

// ── Auto-renderer ──
export { FormspecForm } from './renderer';
export type { FormspecFormProps } from './renderer';
export { FormspecNode } from './node-renderer';

// ── Default components (for composition / override bases) ──
export { DefaultField } from './defaults/fields/default-field';
export { DefaultLayout } from './defaults/layout/default-layout';
export { ValidationSummary } from './validation-summary';
export type { ValidationSummaryProps } from './validation-summary';
