import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FormspecRender } from 'formspec-webcomponent';
import { App } from './App';
import './index.css';

if (!customElements.get('formspec-render')) {
  customElements.define('formspec-render', FormspecRender);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
