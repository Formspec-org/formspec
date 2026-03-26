/** @filedesc Demo app showcasing formspec-react with zero component overrides. */
import React, { useState } from 'react';
import { FormspecForm, ValidationSummary } from 'formspec-react';
import type { SubmitResult } from 'formspec-react';
import definition from './definition.json';
import registry from '../../../registries/formspec-common.registry.json';

// ── App ──

export function App() {
    const [result, setResult] = useState<SubmitResult | null>(null);

    const results = result?.validationReport?.results || [];
    const errorCount = results.filter((r: any) => r.severity === 'error').length;
    const warningCount = results.filter((r: any) => r.severity === 'warning').length;

    return (
        <div className="app-container">
            <a href="#main-content" className="skip-link">
                Skip to main content
            </a>
            <header className="app-header">
                <div className="demo-banner" role="status">
                    <span className="demo-banner-label">Demo</span>
                    <span className="demo-banner-text">
                        This is a live demo of <strong>formspec-react</strong> using zero component overrides — all rendering comes from the built-in defaults.
                    </span>
                </div>
                <div className="app-badges">
                    <span aria-hidden="true" className="app-badge app-badge--primary">Formspec</span>
                    <span aria-hidden="true" className="app-badge app-badge--outline">React</span>
                    <span aria-hidden="true" className="app-badge app-badge--outline">Demo</span>
                </div>
                <h1 id="app-form-title" className="app-title">Generic Form</h1>
                <p className="app-subtitle">
                    A sample form demonstrating Formspec's declarative rendering, validation, FEL expressions, and theme tokens.
                    All fields marked <span className="formspec-required" aria-hidden="true">*</span> are required.
                </p>
            </header>

            <main id="main-content">
                <FormspecForm
                    definition={definition}
                    registryEntries={registry.entries}
                    onSubmit={setResult}
                />

                {result && (
                    <div className="submit-panel">
                        <div className="submit-row">
                            <span className={`status-text ${result.validationReport?.valid ? 'status-text--valid' : 'status-text--invalid'}`}>
                                {result.validationReport?.valid ? 'Valid' : `${errorCount} error(s)`}
                                {warningCount > 0 && `, ${warningCount} warning(s)`}
                            </span>
                        </div>

                        {results.length > 0 && <ValidationSummary results={results} />}

                        <details className="response-details">
                            <summary>Response JSON</summary>
                            <pre>{JSON.stringify(result.response, null, 2)}</pre>
                        </details>
                    </div>
                )}
            </main>

            <footer className="app-footer">
                <p>
                    Formspec React Demo — <code>examples/react-demo/</code>
                </p>
            </footer>
        </div>
    );
}
