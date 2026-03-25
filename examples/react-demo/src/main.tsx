/** @filedesc Entry point for the formspec-react demo app. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { initFormspecEngine } from 'formspec-engine';
import './globals.css';
import { App } from './App';

async function boot() {
    await initFormspecEngine();
    createRoot(document.getElementById('root')!).render(<App />);
}

boot().catch(console.error);
