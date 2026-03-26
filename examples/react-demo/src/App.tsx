/** @filedesc Demo app showcasing formspec-react with zero component overrides. */
import React, { useState, useCallback } from 'react';
import { FormspecProvider, FormspecNode, useForm, useFormspecContext, ValidationSummary } from 'formspec-react';
import definition from './definition.json';
import registry from '../../../registries/formspec-common.registry.json';

// ── Form content (layout + submit panel) ──

function FormContent() {
    const form = useForm();
    const { engine, layoutPlan, touchField } = useFormspecContext();
    const [result, setResult] = useState<any>(null);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
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
    }, [form, engine, touchField]);

    if (!layoutPlan) return <p>No layout plan available.</p>;

    const results = result?.validationReport?.results || [];
    const errorCount = results.filter((r: any) => r.severity === 'error').length;
    const warningCount = results.filter((r: any) => r.severity === 'warning').length;

    return (
        <form onSubmit={handleSubmit} noValidate>
            <FormspecNode node={layoutPlan} />

            <div className="submit-panel">
                <div className="submit-row">
                    <button type="submit" className="submit-button">
                        Submit Application
                    </button>
                    {result && (
                        <span className={`status-text ${result.validationReport?.valid ? 'status-text--valid' : 'status-text--invalid'}`}>
                            {result.validationReport?.valid ? 'Valid' : `${errorCount} error(s)`}
                            {warningCount > 0 && `, ${warningCount} warning(s)`}
                        </span>
                    )}
                </div>

                {results.length > 0 && <ValidationSummary results={results} />}

                {result && (
                    <details className="response-details">
                        <summary>Response JSON</summary>
                        <pre>{JSON.stringify(result.response, null, 2)}</pre>
                    </details>
                )}
            </div>
        </form>
    );
}

// ── App ──

export function App() {
    return (
        <div className="app-container">
            <a href="#main-content" className="skip-link">
                Skip to main content
            </a>
            <header className="app-header">
                <div className="app-badges">
                    <span aria-hidden="true" className="app-badge app-badge--primary">Formspec</span>
                    <span aria-hidden="true" className="app-badge app-badge--outline">React</span>
                </div>
                <h1 className="app-title">Community Impact Grant Application</h1>
                <p className="app-subtitle">
                    Apply for up to $100,000 to fund community-focused projects in education,
                    health, environment, or arts. All fields marked <span className="formspec-required" aria-hidden="true">*</span> are required.
                </p>
            </header>

            <main id="main-content">
                <FormspecProvider definition={definition} registryEntries={registry.entries}>
                    <FormContent />
                </FormspecProvider>
            </main>
        </div>
    );
}
