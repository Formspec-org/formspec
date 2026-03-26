/** @filedesc ValidationSummary — displays validation results with jump-to-field links. */
import React, { useRef, useEffect, useCallback } from 'react';
import { useFormspecContext } from './context';

export interface ValidationSummaryProps {
    /** Validation results from engine.getValidationReport(). */
    results: Array<{ path: string; message: string; severity: string }>;
    /** Whether to auto-focus the summary when results appear. */
    autoFocus?: boolean;
    /** Optional className override for the container. */
    className?: string;
}

interface ResolvedResult {
    path: string;
    message: string;
    severity: string;
    label: string;
    fieldId: string;
}

/**
 * Renders a validation error/warning summary with clickable jump links.
 * Resolves field paths to human-readable labels and field element IDs
 * via the FormEngine's FieldViewModels.
 */
export function ValidationSummary({ results, autoFocus = true, className }: ValidationSummaryProps) {
    const { engine } = useFormspecContext();
    const containerRef = useRef<HTMLDivElement>(null);

    const errors = results.filter(r => r.severity === 'error');
    const warnings = results.filter(r => r.severity === 'warning');

    // Resolve paths to labels + IDs
    const resolve = useCallback((items: typeof results): ResolvedResult[] => {
        return items.map(r => {
            try {
                const vm = engine.getFieldVM(r.path);
                return { ...r, label: vm?.label.value || r.path, fieldId: vm?.id || '' };
            } catch {
                return { ...r, label: r.path, fieldId: '' };
            }
        });
    }, [engine]);

    const resolvedErrors = resolve(errors);
    const resolvedWarnings = resolve(warnings);

    // Auto-focus on mount when errors exist
    useEffect(() => {
        if (autoFocus && errors.length > 0 && containerRef.current) {
            containerRef.current.focus();
        }
    }, [autoFocus, errors.length]);

    const handleJump = useCallback((e: React.MouseEvent, fieldId: string) => {
        e.preventDefault();
        const el = document.getElementById(fieldId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus({ preventScroll: true });
        }
    }, []);

    if (errors.length === 0 && warnings.length === 0) return null;

    return (
        <div className={className || 'formspec-validation-summary'}>
            {resolvedErrors.length > 0 && (
                <div ref={containerRef} tabIndex={-1} role="alert"
                     className="formspec-validation-summary__errors">
                    <h3 className="formspec-validation-summary__heading">
                        {resolvedErrors.length === 1
                            ? 'Please fix this error before continuing:'
                            : `Please fix these ${resolvedErrors.length} errors before continuing:`}
                    </h3>
                    <ul className="formspec-validation-summary__list">
                        {resolvedErrors.map((r, i) => (
                            <li key={i} className="formspec-validation-summary__item formspec-validation-summary__item--error">
                                {r.fieldId ? (
                                    <a href={`#${r.fieldId}`}
                                       className="formspec-validation-summary__link"
                                       onClick={(e) => handleJump(e, r.fieldId)}>
                                        {r.label}
                                    </a>
                                ) : (
                                    <span>{r.label}</span>
                                )}
                                : {r.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {resolvedWarnings.length > 0 && (
                <div className="formspec-validation-summary__warnings">
                    <h3 className="formspec-validation-summary__heading">Warnings</h3>
                    <ul className="formspec-validation-summary__list">
                        {resolvedWarnings.map((r, i) => (
                            <li key={i} className="formspec-validation-summary__item formspec-validation-summary__item--warning">
                                {r.fieldId ? (
                                    <a href={`#${r.fieldId}`}
                                       className="formspec-validation-summary__link"
                                       onClick={(e) => handleJump(e, r.fieldId)}>
                                        {r.label}
                                    </a>
                                ) : (
                                    <span>{r.label}</span>
                                )}
                                : {r.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
