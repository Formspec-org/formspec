/** @filedesc FormspecScreener — standalone eligibility gate component. */
import React, { useMemo } from 'react';
import { createFormEngine } from '@formspec-org/engine';
import type { IFormEngine } from '@formspec-org/engine';
import { useScreener, itemDataType, itemOptions, isItemRequired } from './use-screener';
import type { UseScreenerOptions, ScreenerRoute } from './types';

export interface FormspecScreenerProps extends UseScreenerOptions {
    /** The Formspec definition containing a screener block. */
    definition: any;
    /** Pre-built engine. If omitted, one is created from the definition. */
    engine?: IFormEngine;
    /** Render prop for the external route result. */
    renderExternalRoute?: (route: ScreenerRoute) => React.ReactNode;
    /** Render prop for the "no match" result. */
    renderNoMatch?: () => React.ReactNode;
    /** CSS className on the root container. */
    className?: string;
}

export function FormspecScreener({
    definition,
    engine: externalEngine,
    renderExternalRoute,
    renderNoMatch,
    className,
    ...options
}: FormspecScreenerProps) {
    // Create a minimal engine if not provided (just needs evaluateScreener)
    const engine = useMemo(() => {
        if (externalEngine) return externalEngine;
        return createFormEngine(definition);
    }, [externalEngine, definition]);

    const screener = useScreener(engine, definition, options);
    const items: any[] = definition?.screener?.items ?? [];

    if (!definition?.screener) return null;

    // External route result
    if (screener.routeResult?.routeType === 'external') {
        if (renderExternalRoute) {
            return <>{renderExternalRoute(screener.routeResult.route)}</>;
        }
        return (
            <div className={cls('formspec-screener-result', className)}>
                <h2>{screener.routeResult.route.label || 'Not Eligible'}</h2>
                {screener.routeResult.route.target && (
                    <p>{screener.routeResult.route.target}</p>
                )}
                <button
                    type="button"
                    className="formspec-screener-restart"
                    onClick={screener.restart}
                >
                    Start Over
                </button>
            </div>
        );
    }

    // No match result
    if (screener.routeResult?.routeType === 'none') {
        if (renderNoMatch) return <>{renderNoMatch()}</>;
        return (
            <div className={cls('formspec-screener-result', className)}>
                <p>No matching eligibility route was found.</p>
                <button
                    type="button"
                    className="formspec-screener-restart"
                    onClick={screener.restart}
                >
                    Start Over
                </button>
            </div>
        );
    }

    // Internal route — screener is done, return null (FormspecForm will render the form)
    if (screener.routeResult?.routeType === 'internal' || screener.skipped) {
        return null;
    }

    // Render screener form
    return (
        <div className={cls('formspec-screener', className)}>
            <h2>{definition.screener.title || 'Eligibility Check'}</h2>
            {definition.screener.description && (
                <p className="formspec-screener-description">{definition.screener.description}</p>
            )}
            <div className="formspec-screener-fields">
                {items.map((item: any) => (
                    <ScreenerField
                        key={item.key}
                        item={item}
                        screener={definition.screener}
                        engine={engine}
                        answers={screener.answers}
                        value={screener.answers[item.key]}
                        error={screener.errors[item.key]}
                        onChange={(val) => screener.setAnswer(item.key, val)}
                    />
                ))}
            </div>
            <button
                type="button"
                className="formspec-screener-submit formspec-submit"
                onClick={screener.submit}
            >
                {definition.screener.submitLabel || 'Check Eligibility'}
            </button>
        </div>
    );
}

/** Renders a single screener field based on its type. */
function ScreenerField({
    item,
    screener,
    engine,
    answers,
    value,
    error,
    onChange,
}: {
    item: any;
    screener: any;
    engine: IFormEngine;
    answers: Record<string, any>;
    value: any;
    error?: string;
    onChange: (val: any) => void;
}) {
    const id = `screener-${item.key}`;
    const showError = !!error;
    const dt = itemDataType(item);
    const required = isItemRequired(item, screener, engine, answers);

    const renderInput = () => {
        switch (dt) {
            case 'boolean':
                return (
                    <div className="formspec-field--inline">
                        <input
                            id={id}
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => onChange(e.target.checked)}
                            aria-invalid={showError}
                        />
                        <label htmlFor={id}>{item.label}</label>
                    </div>
                );

            case 'choice':
                return (
                    <>
                        <label htmlFor={id}>
                            {item.label}
                            {required && <span className="formspec-required" aria-hidden="true">*</span>}
                        </label>
                        <select
                            id={id}
                            value={value ?? ''}
                            onChange={(e) => onChange(e.target.value)}
                            aria-invalid={showError}
                        >
                            <option value="" disabled hidden>Select…</option>
                            {itemOptions(item).map((c: any) => (
                                <option key={c.value ?? c} value={c.value ?? c}>
                                    {c.label ?? c}
                                </option>
                            ))}
                        </select>
                    </>
                );

            case 'integer':
            case 'decimal':
                return (
                    <>
                        <label htmlFor={id}>
                            {item.label}
                            {required && <span className="formspec-required" aria-hidden="true">*</span>}
                        </label>
                        <input
                            id={id}
                            type="number"
                            step={dt === 'decimal' ? 'any' : '1'}
                            value={value ?? ''}
                            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
                            aria-invalid={showError}
                        />
                    </>
                );

            case 'money':
                return (
                    <>
                        <label htmlFor={id}>
                            {item.label}
                            {required && <span className="formspec-required" aria-hidden="true">*</span>}
                        </label>
                        <div className="formspec-money-field">
                            <span className="formspec-money-currency">{item.currency || 'USD'}</span>
                            <input
                                id={id}
                                type="text"
                                inputMode="decimal"
                                value={typeof value === 'object' ? (value?.amount ?? '') : (value ?? '')}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    onChange(raw === '' ? null : { amount: Number(raw), currency: item.currency || 'USD' });
                                }}
                                aria-invalid={showError}
                            />
                        </div>
                    </>
                );

            case 'text':
            case 'string':
            default:
                return (
                    <>
                        <label htmlFor={id}>
                            {item.label}
                            {required && <span className="formspec-required" aria-hidden="true">*</span>}
                        </label>
                        <input
                            id={id}
                            type="text"
                            value={value ?? ''}
                            onChange={(e) => onChange(e.target.value)}
                            aria-invalid={showError}
                        />
                    </>
                );
        }
    };

    return (
        <div className="formspec-field formspec-screener-field" data-name={item.key}>
            {renderInput()}
            {showError && (
                <p className="formspec-error" aria-live="polite">{error}</p>
            )}
        </div>
    );
}

/** Join base class with optional extra className. */
function cls(base: string, extra?: string): string {
    return extra ? `${base} ${extra}` : base;
}
