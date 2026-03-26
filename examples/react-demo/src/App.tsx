/** @filedesc Demo app showcasing formspec-react: auto-renderer + hooks-only patterns. */
import React, { useState, useCallback, useRef } from 'react';
import { FormspecProvider, FormspecNode, useForm, useFormspecContext } from 'formspec-react';
import type { FieldComponentProps, LayoutComponentProps } from 'formspec-react';
import definition from './definition.json';
import registry from '../../../registries/formspec-common.registry.json';

// ── Shared ARIA helpers ──

/** Build aria-describedby from optional hint/error element IDs (WCAG 1.3.1). */
function buildDescribedBy(fieldId: string, hasHint: boolean, showError: boolean | string | null | undefined): string | undefined {
    const ids = [
        hasHint ? `${fieldId}-hint` : '',
        showError ? `${fieldId}-error` : '',
    ].filter(Boolean).join(' ');
    return ids || undefined;
}

/** Autocomplete mapping for identity/contact fields (WCAG 1.3.5). */
const autoCompleteMap: Record<string, string> = {
    'contact.contactName': 'name',
    'contact.contactEmail': 'email',
    'contact.contactPhone': 'tel',
    'organization.website': 'url',
};

// ── Custom styled components (override defaults via component map) ──

function StyledTextInput({ field, node }: FieldComponentProps) {
    if (!field.visible) return null;
    const isTextarea = field.dataType === 'text';
    const showError = field.error && field.touched;
    const describedBy = buildDescribedBy(field.id, !!field.hint, showError);
    const autoComplete = autoCompleteMap[field.path];
    return (
        <div className="mb-5" data-name={field.path}>
            <label htmlFor={field.id} className="mb-1.5 block text-sm font-semibold text-foreground">
                {field.label}
                {field.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
            </label>
            {field.hint && <p id={`${field.id}-hint`} className="formspec-hint">{field.hint}</p>}
            {isTextarea ? (
                <textarea
                    id={field.id}
                    value={field.value ?? ''}
                    onChange={e => field.setValue(e.target.value)}
                    onBlur={() => field.touch()}
                    required={field.required}
                    readOnly={field.readonly}
                    aria-invalid={!!showError}
                    aria-describedby={describedBy}
                    className={showError ? 'border-destructive focus:border-destructive' : ''}
                />
            ) : (
                <input
                    id={field.id}
                    type="text"
                    value={field.value ?? ''}
                    onChange={e => field.setValue(e.target.value)}
                    onBlur={() => field.touch()}
                    required={field.required}
                    readOnly={field.readonly}
                    aria-invalid={!!showError}
                    aria-describedby={describedBy}
                    autoComplete={autoComplete}
                    className={showError ? 'border-destructive focus:border-destructive' : ''}
                />
            )}
            {showError && <p id={`${field.id}-error`} className="formspec-error" role="alert">{field.error}</p>}
        </div>
    );
}

function StyledSelect({ field, node }: FieldComponentProps) {
    if (!field.visible) return null;
    const showError = field.error && field.touched;
    const describedBy = buildDescribedBy(field.id, !!field.hint, showError);
    return (
        <div className="mb-5" data-name={field.path}>
            <label htmlFor={field.id} className="mb-1.5 block text-sm font-semibold text-foreground">
                {field.label}
                {field.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
            </label>
            {field.hint && <p id={`${field.id}-hint`} className="formspec-hint">{field.hint}</p>}
            <select
                id={field.id}
                value={field.value ?? ''}
                onChange={e => field.setValue(e.target.value)}
                onBlur={() => field.touch()}
                aria-invalid={!!showError}
                aria-describedby={describedBy}
                className={showError ? 'border-destructive' : ''}
            >
                <option value="" disabled>-- Select --</option>
                {field.options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
            {showError && <p id={`${field.id}-error`} className="formspec-error" role="alert">{field.error}</p>}
        </div>
    );
}

function StyledRadioGroup({ field, node }: FieldComponentProps) {
    if (!field.visible) return null;
    const showError = field.error && field.touched;
    const describedBy = buildDescribedBy(field.id, !!field.hint, showError);
    return (
        <fieldset className="mb-5 border-0 p-0" data-name={field.path} aria-describedby={describedBy}>
            <legend className="mb-1.5 text-sm font-semibold text-foreground">
                {field.label}
                {field.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
            </legend>
            {field.hint && <p id={`${field.id}-hint`} className="formspec-hint">{field.hint}</p>}
            <div className="mt-2 grid gap-2">
                {field.options.map(o => (
                    <label
                        key={o.value}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-input bg-card px-4 py-3 transition-colors hover:border-ring has-[input:checked]:border-primary has-[input:checked]:bg-primary/5"
                    >
                        <input
                            type="radio"
                            name={field.path}
                            value={o.value}
                            checked={field.value === o.value}
                            onChange={() => { field.setValue(o.value); field.touch(); }}
                        />
                        <span className="text-sm font-medium">{o.label}</span>
                    </label>
                ))}
            </div>
            {showError && <p id={`${field.id}-error`} className="formspec-error" role="alert">{field.error}</p>}
        </fieldset>
    );
}

function StyledCheckboxGroup({ field, node }: FieldComponentProps) {
    if (!field.visible) return null;
    const current = Array.isArray(field.value) ? field.value : [];
    const showError = field.error && field.touched;
    const describedBy = buildDescribedBy(field.id, !!field.hint, showError);
    return (
        <fieldset className="mb-5 border-0 p-0" data-name={field.path} aria-describedby={describedBy}>
            <legend className="mb-1.5 text-sm font-semibold text-foreground">
                {field.label}
                {field.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
            </legend>
            {field.hint && <p id={`${field.id}-hint`} className="formspec-hint">{field.hint}</p>}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {field.options.map(o => (
                    <label
                        key={o.value}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-input bg-card px-4 py-3 transition-colors hover:border-ring has-[input:checked]:border-primary has-[input:checked]:bg-primary/5"
                    >
                        <input
                            type="checkbox"
                            value={o.value}
                            checked={current.includes(o.value)}
                            onChange={e => {
                                const next = e.target.checked
                                    ? [...current, o.value]
                                    : current.filter((v: string) => v !== o.value);
                                field.setValue(next);
                                field.touch();
                            }}
                        />
                        <span className="text-sm font-medium">{o.label}</span>
                    </label>
                ))}
            </div>
            {showError && <p id={`${field.id}-error`} className="formspec-error" role="alert">{field.error}</p>}
        </fieldset>
    );
}

function StyledCheckbox({ field, node }: FieldComponentProps) {
    if (!field.visible) return null;
    const showError = field.error && field.touched;
    const describedBy = buildDescribedBy(field.id, false, showError);
    return (
        <div className="mb-4 flex items-start gap-3" data-name={field.path}>
            <input
                id={field.id}
                type="checkbox"
                checked={!!field.value}
                onChange={e => { field.setValue(e.target.checked); field.touch(); }}
                aria-invalid={!!showError}
                aria-describedby={describedBy}
                className="mt-0.5"
            />
            <label htmlFor={field.id} className="text-sm font-medium leading-snug text-foreground mb-0">
                {field.label}
                {field.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
            </label>
            {showError && <p id={`${field.id}-error`} className="formspec-error" role="alert">{field.error}</p>}
        </div>
    );
}

function StyledNumberInput({ field, node }: FieldComponentProps) {
    if (!field.visible) return null;
    const showError = field.error && field.touched;
    const describedBy = buildDescribedBy(field.id, !!field.hint, showError);
    return (
        <div className="mb-5" data-name={field.path}>
            <label htmlFor={field.id} className="mb-1.5 block text-sm font-semibold text-foreground">
                {field.label}
                {field.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
            </label>
            {field.hint && <p id={`${field.id}-hint`} className="formspec-hint">{field.hint}</p>}
            <input
                id={field.id}
                type="number"
                value={field.value ?? ''}
                onChange={e => field.setValue(e.target.value === '' ? null : Number(e.target.value))}
                onBlur={() => field.touch()}
                required={field.required}
                readOnly={field.readonly}
                aria-invalid={!!showError}
                aria-describedby={describedBy}
                className={showError ? 'border-destructive' : ''}
            />
            {showError && <p id={`${field.id}-error`} className="formspec-error" role="alert">{field.error}</p>}
        </div>
    );
}

function StyledDatePicker({ field, node }: FieldComponentProps) {
    if (!field.visible) return null;
    const showError = field.error && field.touched;
    const describedBy = buildDescribedBy(field.id, !!field.hint, showError);
    return (
        <div className="mb-5" data-name={field.path}>
            <label htmlFor={field.id} className="mb-1.5 block text-sm font-semibold text-foreground">
                {field.label}
                {field.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
            </label>
            {field.hint && <p id={`${field.id}-hint`} className="formspec-hint">{field.hint}</p>}
            <input
                id={field.id}
                type="date"
                value={field.value ?? ''}
                onChange={e => field.setValue(e.target.value)}
                onBlur={() => field.touch()}
                aria-invalid={!!showError}
                aria-describedby={describedBy}
                className={showError ? 'border-destructive' : ''}
            />
            {showError && <p id={`${field.id}-error`} className="formspec-error" role="alert">{field.error}</p>}
        </div>
    );
}

function StyledFileUpload({ field, node }: FieldComponentProps) {
    if (!field.visible) return null;
    const describedBy = field.hint ? `${field.id}-hint` : undefined;
    return (
        <div className="mb-5" data-name={field.path}>
            <label htmlFor={field.id} className="mb-1.5 block text-sm font-semibold text-foreground">
                {field.label}
            </label>
            {field.hint && <p id={`${field.id}-hint`} className="formspec-hint">{field.hint}</p>}
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-input bg-card px-6 py-8 transition-colors hover:border-ring">
                <div className="text-center">
                    <p className="mb-2 text-sm text-muted-foreground">Drag & drop or click to upload</p>
                    <input
                        id={field.id}
                        type="file"
                        onChange={e => field.setValue(e.target.files)}
                        aria-describedby={describedBy}
                        className="cursor-pointer text-sm"
                    />
                </div>
            </div>
        </div>
    );
}

function StyledCard({ node, children }: LayoutComponentProps) {
    const label = node.fieldItem?.label || (node.props?.title as string);
    return (
        <section className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            {label && (
                <h3 className="mb-5 border-b border-border pb-3 text-lg font-bold tracking-tight text-foreground">
                    {label}
                </h3>
            )}
            {children}
        </section>
    );
}

function StyledStack({ node, children }: LayoutComponentProps) {
    const title = node.props?.title as string | undefined;
    if (title && node.bindPath) {
        return (
            <section className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
                <h3 className="mb-5 border-b border-border pb-3 text-lg font-bold tracking-tight text-foreground">
                    {title}
                </h3>
                {children}
            </section>
        );
    }
    return <div>{children}</div>;
}

// ── Component map ──

const componentOverrides = {
    fields: {
        TextInput: StyledTextInput,
        Select: StyledSelect,
        RadioGroup: StyledRadioGroup,
        CheckboxGroup: StyledCheckboxGroup,
        Checkbox: StyledCheckbox,
        Toggle: StyledCheckbox,
        NumberInput: StyledNumberInput,
        DatePicker: StyledDatePicker,
        FileUpload: StyledFileUpload,
    },
    layout: {
        Card: StyledCard,
        Section: StyledCard,
        Stack: StyledStack,
    },
};

// ── Form content (merges FormBody + SubmitPanel with proper <form> wrapper) ──

function FormContent() {
    const form = useForm();
    const { engine, layoutPlan, touchField } = useFormspecContext();
    const [result, setResult] = useState<any>(null);
    const errorSummaryRef = useRef<HTMLDivElement>(null);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        // Touch all fields so validation errors become visible
        const def = engine.getDefinition();
        const touchAllFields = (items: any[], prefix = '') => {
            for (const item of items) {
                const path = prefix ? `${prefix}.${item.key}` : item.key;
                if (item.type === 'field') touchField(path);
                if (item.children) touchAllFields(item.children, path);
            }
        };
        touchAllFields(def.items || []);

        const detail = form.submit({ mode: 'submit' });
        setResult(detail);

        // Focus error summary after render so screen reader users are notified
        setTimeout(() => {
            if (!detail.validationReport?.valid && errorSummaryRef.current) {
                errorSummaryRef.current.focus();
            }
        }, 0);
    }, [form, engine, touchField]);

    if (!layoutPlan) return <p>No layout plan available.</p>;

    const errors = result?.validationReport?.results?.filter((r: any) => r.severity === 'error') || [];
    const warnings = result?.validationReport?.results?.filter((r: any) => r.severity === 'warning') || [];

    return (
        <form onSubmit={handleSubmit} noValidate>
            <FormspecNode node={layoutPlan} />

            <div className="mt-8 space-y-4">
                <div className="flex items-center gap-4">
                    <button
                        type="submit"
                        className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        Submit Application
                    </button>
                    {result && (
                        <span className={`text-sm font-medium ${result.validationReport?.valid ? 'text-success' : 'text-destructive'}`}>
                            {result.validationReport?.valid ? 'Valid' : `${errors.length} error(s)`}
                            {warnings.length > 0 && `, ${warnings.length} warning(s)`}
                        </span>
                    )}
                </div>

                {errors.length > 0 && (
                    <div ref={errorSummaryRef} tabIndex={-1} role="alert"
                         className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <h2 className="mb-2 text-sm font-bold text-destructive">Validation Errors</h2>
                        <ul className="list-inside list-disc space-y-1 text-sm text-destructive/80">
                            {errors.map((e: any, i: number) => (
                                <li key={i}><span className="font-medium">{e.path}</span>: {e.message}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {warnings.length > 0 && (
                    <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                        <h2 className="mb-2 text-sm font-bold text-warning">Warnings</h2>
                        <ul className="list-inside list-disc space-y-1 text-sm text-warning/80">
                            {warnings.map((w: any, i: number) => (
                                <li key={i}><span className="font-medium">{w.path}</span>: {w.message}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {result && (
                    <details className="rounded-lg border border-border bg-card p-4">
                        <summary className="cursor-pointer text-sm font-semibold">Response JSON</summary>
                        <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
                            {JSON.stringify(result.response, null, 2)}
                        </pre>
                    </details>
                )}
            </div>
        </form>
    );
}

// ── App ──

export function App() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-10">
            <a href="#main-content"
               className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
                Skip to main content
            </a>
            <header className="mb-10">
                <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="rounded-md bg-primary px-2.5 py-1 text-xs font-bold tracking-widest text-primary-foreground uppercase">
                        Formspec
                    </span>
                    <span aria-hidden="true" className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        React
                    </span>
                </div>
                <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">
                    Community Impact Grant Application
                </h1>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                    Apply for up to $100,000 to fund community-focused projects in education,
                    health, environment, or arts. All fields marked <span className="font-semibold text-destructive" aria-hidden="true">*</span> are required.
                </p>
            </header>

            <main id="main-content">
                <FormspecProvider definition={definition} registryEntries={registry.entries} components={componentOverrides}>
                    <FormContent />
                </FormspecProvider>
            </main>
        </div>
    );
}
