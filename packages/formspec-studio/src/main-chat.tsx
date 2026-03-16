import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionStore } from 'formspec-chat';
import { ChatShell } from './chat/index.js';
import './index.css';

// Pre-seed Gemini dev key if no provider is configured
const PROVIDER_KEY = 'formspec-chat:provider';
if (!localStorage.getItem(PROVIDER_KEY)) {
  localStorage.setItem(PROVIDER_KEY, JSON.stringify({
    provider: 'google',
    apiKey: 'AIzaSyCYAy6PIZw664oLQg4CM8DOf86x15TYD1s',
  }));
}

const store = new SessionStore(localStorage);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChatShell store={store} storage={localStorage} />
  </StrictMode>
);
