/** @filedesc Entry point for the Studio app; registers the formspec-render custom element and mounts App. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@formspec-org/webcomponent/formspec-default.css';
import { FormspecRender } from '@formspec-org/webcomponent';
import { App } from './App';
import './index.css';

if (!customElements.get('formspec-render')) {
  customElements.define('formspec-render', FormspecRender);
}

const rootElement = document.getElementById('root')!;
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
