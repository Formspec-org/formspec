import { useRef, useEffect } from 'react';
import { useProjectState } from '../../state/useProjectState';
import { formspecBaseCssHref } from './formspec-base-css-url';
import { normalizeComponentDoc, normalizeDefinitionDoc, normalizeThemeDoc } from './preview-documents';

const DEBOUNCE_MS = 300;

interface FormspecPreviewHostProps {
  width: string | number;
}

type FormspecRenderElement = HTMLElement & {
  registryDocuments: unknown | unknown[];
  definition: unknown;
  componentDocument: unknown;
  themeDocument: unknown;
};

/** Clone to a plain object so the webcomponent gets JSON-like data (avoids proxy/getter issues). */
function plain<T>(x: T): T {
  if (x === null || x === undefined) return x;
  try {
    return JSON.parse(JSON.stringify(x)) as T;
  } catch {
    return x;
  }
}

function syncToElement(
  el: FormspecRenderElement | null,
  state: ReturnType<typeof useProjectState>
) {
  if (!el) return;
  try {
    const registries = state.extensions?.registries ?? [];
    const registryDocs = registries.map((r: { document: unknown }) => r.document).filter(Boolean);
    el.registryDocuments = registryDocs.length > 0 ? plain(registryDocs) : (undefined as unknown);
    const normalizedDef = normalizeDefinitionDoc(state.definition);
    el.definition = plain(normalizedDef);
    el.componentDocument = plain(normalizeComponentDoc(state.component, normalizedDef));
    el.themeDocument = plain(normalizeThemeDoc(state.theme, state.definition));
  } catch (err) {
    console.error('[FormspecPreviewHost] Sync failed', err);
  }
}

export function FormspecPreviewHost({ width }: FormspecPreviewHostProps) {
  const state = useProjectState();
  const stateRef = useRef(state);
  stateRef.current = state;

  const hostRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<FormspecRenderElement | null>(null);

  // Inject base CSS into document.head — form content lives in the element's light DOM,
  // so document-level CSS reaches it (no shadow isolation needed on our side).
  useEffect(() => {
    if (!formspecBaseCssHref) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = formspecBaseCssHref;
    link.setAttribute('data-formspec-preview-base', 'true');
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, []);

  // One-time: create and mount the <formspec-render> element.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const el = document.createElement('formspec-render') as FormspecRenderElement;
    host.appendChild(el);
    renderRef.current = el;

    // Sync after the element is connected so it's ready to render.
    const rafId = requestAnimationFrame(() => {
      syncToElement(el, stateRef.current);
    });

    return () => {
      cancelAnimationFrame(rafId);
      el.remove();
      renderRef.current = null;
    };
  }, []);

  // Debounced sync: state → element properties.
  useEffect(() => {
    const el = renderRef.current;
    const timer = setTimeout(() => {
      syncToElement(el, state);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.definition, state.component, state.theme, state.extensions]);

  // Event listeners for composed events bubbling up from the form.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const onSubmit = (e: Event) => {
      const ev = e as CustomEvent<{ response?: unknown; validationReport?: unknown }>;
      console.info('[Preview] formspec-submit', ev.detail);
    };
    const onScreenerRoute = (e: Event) => {
      console.info('[Preview] formspec-screener-route', (e as CustomEvent).detail);
    };
    const onScreenerStateChange = (e: Event) => {
      console.info('[Preview] formspec-screener-state-change', (e as CustomEvent).detail);
    };

    host.addEventListener('formspec-submit', onSubmit);
    host.addEventListener('formspec-screener-route', onScreenerRoute);
    host.addEventListener('formspec-screener-state-change', onScreenerStateChange);
    return () => {
      host.removeEventListener('formspec-submit', onSubmit);
      host.removeEventListener('formspec-screener-route', onScreenerRoute);
      host.removeEventListener('formspec-screener-state-change', onScreenerStateChange);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      data-testid="formspec-preview-host"
      style={{ width, maxWidth: '100%', margin: '0 auto' }}
    />
  );
}
