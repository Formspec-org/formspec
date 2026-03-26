/** @filedesc Entry point for the formspec-react demo app. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { initFormspecEngine } from 'formspec-engine';

// 1. Library CSS — standalone form styling with --formspec-* variables
import '../../../packages/formspec-react/src/formspec.css';
// 2. App CSS — shell styling (header, submit panel, etc.)
import './globals.css';

import { App } from './App';
import theme from './theme.json';

/** Emit theme.json tokens as --formspec-* CSS custom properties on :root. */
function emitThemeTokens(tokens: Record<string, string | number>) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(tokens)) {
        root.style.setProperty(`--formspec-${key.replace(/\./g, '-')}`, String(value));
    }
}

async function boot() {
    await initFormspecEngine();
    emitThemeTokens(theme.tokens);
    createRoot(document.getElementById('root')!).render(<App />);
}

boot().catch(console.error);
