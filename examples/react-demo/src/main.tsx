/** @filedesc Entry point for the formspec-react demo app. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { initFormspecEngine } from 'formspec-engine';
import { emitThemeTokens } from 'formspec-react';

// 1. Library CSS — standalone form styling with --formspec-* variables
import '../../../packages/formspec-react/src/formspec.css';
// 2. App CSS — shell styling (header, submit panel, etc.)
import './globals.css';

import { App } from './App';
import theme from './theme.json';

async function boot() {
    await initFormspecEngine();
    emitThemeTokens(theme.tokens);
    createRoot(document.getElementById('root')!).render(<App />);
}

boot().catch(console.error);
