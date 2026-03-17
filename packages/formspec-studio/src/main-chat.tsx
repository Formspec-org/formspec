/** @filedesc Entry point for the chat-only build; seeds a Gemini dev key and mounts ChatShell. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionStore } from 'formspec-chat';
import { ChatShell } from './chat/index.js';
import './index.css';

// Pre-seed Gemini dev key from env if no provider is configured
const PROVIDER_KEY = 'formspec-chat:provider';
const devKey = import.meta.env.VITE_GEMINI_DEV_KEY;
if (devKey && !localStorage.getItem(PROVIDER_KEY)) {
  localStorage.setItem(PROVIDER_KEY, JSON.stringify({
    provider: 'google',
    apiKey: devKey,
  }));
}

const store = new SessionStore(localStorage);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChatShell store={store} storage={localStorage} />
  </StrictMode>
);
