/** @filedesc Hosts the <formspec-render> web component and syncs project documents to it via props. */
import { useRef, useEffect } from 'react';
import type { IFormEngine } from '@formspec-org/engine/render';
import { applyResponseDataToEngine } from '@formspec-org/webcomponent';
import type { ResolvedTheme } from '../../hooks/useColorScheme';
import { useProjectState } from '../../state/useProjectState';
import { useProject } from '../../state/useProject';
import { formspecLayoutCssHref, formspecDefaultCssHref } from './formspec-base-css-url';
import {
  normalizeComponentDoc,
  normalizeDefinitionDoc,
  normalizeThemeDoc,
} from '@formspec-org/studio-core';
import type {
  FormDefinition,
  ComponentDocument,
  ThemeDocument,
  RegistryDocument,
  FormItem,
} from '@formspec-org/types';

const DEBOUNCE_MS = 300;

const PREVIEW_INSPECT_STYLE_ID = 'formspec-studio-preview-inspect-style';
const PREVIEW_DEVTOOLS_LAYER_CLASS = 'formspec-studio-preview-devtools-layer';
const PREVIEW_DEVTOOLS_BOX_CLASS = 'formspec-studio-preview-devtools-box';
const PREVIEW_DEVTOOLS_TIP_CLASS = 'formspec-studio-preview-devtools-tip';

function collectScrollContainers(from: HTMLElement | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  let p: HTMLElement | null = from;
  while (p) {
    const st = getComputedStyle(p);
    const oy = st.overflowY;
    const ox = st.overflowX;
    if (/(auto|scroll|overlay)/.test(oy) || /(auto|scroll|overlay)/.test(ox)) {
      out.push(p);
    }
    p = p.parentElement;
  }
  return out;
}

function escapeAttrSelector(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Match webcomponent field roots (`createFieldDOM` sets `data-name` to the engine field path). */
function findPreviewFieldRoot(previewHost: HTMLElement, fieldPath: string): HTMLElement | null {
  const esc = escapeAttrSelector(fieldPath);
  const field = previewHost.querySelector(`.formspec-field[data-name="${esc}"]`);
  if (field instanceof HTMLElement) return field;
  const fieldset = previewHost.querySelector(`.formspec-fieldset[data-name="${esc}"]`);
  return fieldset instanceof HTMLElement ? fieldset : null;
}

interface FormspecPreviewHostProps {
  width: string | number;
  /**
   * When set, forces `<formspec-render>` light/dark appearance to match the Studio shell.
   * Otherwise the web component follows `prefers-color-scheme`, which diverges from the
   * shell when the user picks Light/Dark explicitly or uses a non-system preference.
   */
  appearance?: ResolvedTheme;
  /**
   * When provided (Layout live preview), keeps wizard/tab step in sync with the Layout canvas page.
   * Omit on the Preview tab so layout navigation does not affect that host.
   */
  layoutPreviewPageIndex?: number | null;
  /**
   * When set (Layout live preview), outlines the matching field in the preview (definition path / `data-name`).
   */
  layoutHighlightFieldPath?: string | null;
  /**
   * When set (Behavior lab), hydrates the live engine with the same nested object shape as
   * response `data`. `null` skips re-apply (e.g. invalid JSON) so the last good state remains.
   * Omit on Form / JSON preview.
   */
  scenarioData?: Record<string, unknown> | null;
}

type FormspecRenderElement = HTMLElement & {
  registryDocuments: RegistryDocument | RegistryDocument[];
  definition: FormDefinition;
  componentDocument: ComponentDocument;
  themeDocument: ThemeDocument;
  goToWizardStep?: (index: number) => boolean;
  getEngine?: () => IFormEngine | null;
};

/**
 * Apply scenario / saved-response-shaped data to the live preview engine (same path as
 * `<formspec-render>.initialData`). `undefined` disables hydration (Form / Layout preview).
 */
function applyScenarioToLiveElement(
  el: FormspecRenderElement | null,
  scenario: Record<string, unknown> | null | undefined,
): void {
  if (!el) return;
  if (scenario === undefined) return;
  if (scenario === null) return;
  // Call as a method so `this` stays bound to the custom element.
  const engine = typeof el.getEngine === 'function' ? el.getEngine() : null;
  if (!engine) return;
  try {
    applyResponseDataToEngine(engine, scenario as Record<string, unknown>);
  } catch (err) {
    console.error('[FormspecPreviewHost] applyResponseDataToEngine failed', err);
  }
}

const PREVIEW_NAV_MAX_FRAMES = 48;

function tryNavigatePreviewPage(el: HTMLElement, index: number): boolean {
  const renderEl = el as FormspecRenderElement;
  const wizard = el.querySelector('.formspec-wizard');
  if (wizard) {
    if (typeof renderEl.goToWizardStep === 'function') {
      renderEl.goToWizardStep(index);
    } else {
      wizard.dispatchEvent(
        new CustomEvent('formspec-wizard-set-step', { detail: { index }, bubbles: false }),
      );
    }
    return true;
  }
  const tabs = el.querySelector('.formspec-tabs');
  if (tabs) {
    tabs.dispatchEvent(
      new CustomEvent('formspec-tabs-set-active', { detail: { index }, bubbles: false }),
    );
    return true;
  }
  return false;
}

/** Retry until formspec-render has painted wizard/tabs (debounced doc sync can lag). */
function scheduleNavigatePreviewPage(el: HTMLElement | null, index: number | null) {
  if (!el || index === null || index < 0) return;
  let frames = 0;
  const tick = () => {
    if (tryNavigatePreviewPage(el, index)) return;
    if (frames++ >= PREVIEW_NAV_MAX_FRAMES) return;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Clone to a plain object so the webcomponent gets JSON-like data (avoids proxy/getter issues). */
function plain<T>(x: T): T {
  if (x === null || x === undefined) return x;
  try {
    return JSON.parse(JSON.stringify(x)) as T;
  } catch {
    return x;
  }
}

export function FormspecPreviewHost({
  width,
  appearance,
  layoutPreviewPageIndex,
  layoutHighlightFieldPath,
  scenarioData,
}: FormspecPreviewHostProps) {
  const state = useProjectState();
  const project = useProject();
  const stateRef = useRef(state);
  const projectRef = useRef(project);
  const scenarioDataRef = useRef(scenarioData);
  stateRef.current = state;
  projectRef.current = project;
  scenarioDataRef.current = scenarioData;

  const hostRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<FormspecRenderElement | null>(null);
  const layoutPreviewPageRef = useRef(layoutPreviewPageIndex);
  layoutPreviewPageRef.current = layoutPreviewPageIndex;
  const inspectLayerRef = useRef<HTMLDivElement | null>(null);

  function syncToElement(el: FormspecRenderElement | null) {
    if (!el) return;
    try {
      const s = stateRef.current;
      const p = projectRef.current;

      const registryDocs = p.registryDocuments() as unknown as RegistryDocument[];
      el.registryDocuments = registryDocs.length > 0 ? plain(registryDocs) : (undefined as unknown as RegistryDocument[]);

      el.definition = plain(normalizeDefinitionDoc(s.definition));
      el.componentDocument = plain(normalizeComponentDoc(p.component, s.definition));
      el.themeDocument = plain(normalizeThemeDoc(s.theme, s.definition));
    } catch (err) {
      console.error('[FormspecPreviewHost] Sync failed', err);
    }
  }

  // Chrome DevTools–like inspect overlay (fixed layer; does not mutate form field styles).
  useEffect(() => {
    if (document.getElementById(PREVIEW_INSPECT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = PREVIEW_INSPECT_STYLE_ID;
    style.textContent = `
      .${PREVIEW_DEVTOOLS_LAYER_CLASS} {
        position: fixed;
        inset: 0;
        z-index: 10050;
        pointer-events: none;
        overflow: visible;
      }
      .${PREVIEW_DEVTOOLS_BOX_CLASS} {
        position: absolute;
        box-sizing: border-box;
        border-radius: 2px;
        background: rgba(26, 115, 232, 0.12);
        border: 1px solid rgba(26, 115, 232, 0.92);
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.35) inset,
          0 0 0 1px rgba(26, 115, 232, 0.25);
      }
      .dark .${PREVIEW_DEVTOOLS_BOX_CLASS} {
        background: rgba(138, 180, 248, 0.16);
        border-color: rgba(138, 180, 248, 0.88);
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.08) inset,
          0 0 0 1px rgba(138, 180, 248, 0.2);
      }
      .${PREVIEW_DEVTOOLS_TIP_CLASS} {
        position: absolute;
        box-sizing: border-box;
        max-width: min(420px, calc(100vw - 16px));
        padding: 4px 8px 5px;
        border-radius: 3px;
        font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: 0.01em;
        color: #e8eaed;
        background: #202124;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .${PREVIEW_DEVTOOLS_TIP_CLASS} .formspec-studio-preview-devtools-tip-dim {
        opacity: 0.72;
        font-weight: 500;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Inject formspec CSS into document.head — form content lives in the element's light DOM,
  // so document-level CSS reaches it (no shadow isolation needed on our side).
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    for (const href of [formspecLayoutCssHref, formspecDefaultCssHref]) {
      if (!href) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-formspec-preview-base', 'true');
      document.head.appendChild(link);
      links.push(link);
    }
    return () => { links.forEach(l => l.remove()); };
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
      syncToElement(el);
      applyScenarioToLiveElement(el, scenarioDataRef.current);
    });

    return () => {
      cancelAnimationFrame(rafId);
      el.remove();
      renderRef.current = null;
    };
  }, []);

  // Keep web component appearance aligned with Studio theme (not raw OS preference).
  useEffect(() => {
    const el = renderRef.current;
    if (!el) return;
    if (appearance) {
      el.setAttribute('data-formspec-appearance', appearance);
    } else {
      el.removeAttribute('data-formspec-appearance');
    }
  }, [appearance]);

  // Debounced sync: state → element properties.
  useEffect(() => {
    const el = renderRef.current;
    const timer = setTimeout(() => {
      syncToElement(el);
      applyScenarioToLiveElement(el, scenarioDataRef.current);
      const navIdx = layoutPreviewPageRef.current;
      if (navIdx !== undefined && navIdx !== null && navIdx >= 0) {
        scheduleNavigatePreviewPage(el, navIdx);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.definition, state.component, state.theme]);

  // Re-apply scenario whenever it changes without waiting for the document debounce.
  useEffect(() => {
    if (scenarioData === undefined) return;
    let cancelled = false;
    const id0 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        applyScenarioToLiveElement(renderRef.current, scenarioDataRef.current);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id0);
    };
  }, [scenarioData]);

  // Immediate wizard/tab sync when the Layout canvas active page changes.
  useEffect(() => {
    if (layoutPreviewPageIndex === undefined) return;
    if (layoutPreviewPageIndex === null || layoutPreviewPageIndex < 0) return;
    scheduleNavigatePreviewPage(renderRef.current, layoutPreviewPageIndex);
  }, [layoutPreviewPageIndex]);

  // DevTools-style overlay on the preview field (fixed layer; no classes on the widget).
  useEffect(() => {
    if (layoutHighlightFieldPath === undefined) return;
    const renderEl = renderRef.current;
    if (!renderEl) return;

    const removeInspectLayer = () => {
      const layer = inspectLayerRef.current;
      if (layer) {
        layer.remove();
        inspectLayerRef.current = null;
      }
    };

    if (!layoutHighlightFieldPath) {
      removeInspectLayer();
      return;
    }

    let cancelled = false;
    let frames = 0;
    const scrollContainers: HTMLElement[] = [];
    let syncInspectOverlay: (() => void) | null = null;

    const tick = () => {
      if (cancelled) return;
      const target = findPreviewFieldRoot(renderEl, layoutHighlightFieldPath);
      if (target) {
        removeInspectLayer();
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

        const path = layoutHighlightFieldPath;
        const layer = document.createElement('div');
        layer.className = PREVIEW_DEVTOOLS_LAYER_CLASS;
        layer.setAttribute('role', 'presentation');
        layer.setAttribute('aria-hidden', 'true');

        const box = document.createElement('div');
        box.className = PREVIEW_DEVTOOLS_BOX_CLASS;

        const tip = document.createElement('div');
        tip.className = PREVIEW_DEVTOOLS_TIP_CLASS;
        tip.setAttribute('role', 'status');
        tip.setAttribute('aria-label', `Selected field ${path}`);

        layer.appendChild(box);
        layer.appendChild(tip);
        document.body.appendChild(layer);
        inspectLayerRef.current = layer;

        syncInspectOverlay = () => {
          if (cancelled || !target.isConnected || !layer.isConnected) return;
          const r = target.getBoundingClientRect();
          box.style.left = `${r.left}px`;
          box.style.top = `${r.top}px`;
          box.style.width = `${Math.max(0, r.width)}px`;
          box.style.height = `${Math.max(0, r.height)}px`;

          tip.replaceChildren();
          const pathSpan = document.createElement('span');
          pathSpan.textContent = path;
          const dimSpan = document.createElement('span');
          dimSpan.className = 'formspec-studio-preview-devtools-tip-dim';
          dimSpan.textContent = `  ${Math.round(r.width)} × ${Math.round(r.height)}`;
          tip.appendChild(pathSpan);
          tip.appendChild(dimSpan);

          const edge = 6;
          const h = tip.offsetHeight || 22;
          const preferAbove = r.top >= h + edge + 4;
          let tipTop = preferAbove ? r.top - h - 3 : r.bottom + 4;
          tipTop = Math.max(edge, Math.min(tipTop, window.innerHeight - h - edge));
          tip.style.top = `${tipTop}px`;

          const maxW = Math.min(420, window.innerWidth - edge * 2);
          tip.style.maxWidth = `${maxW}px`;
          let tipLeft = Math.min(r.left, window.innerWidth - edge - 80);
          tipLeft = Math.max(edge, tipLeft);
          tip.style.left = `${tipLeft}px`;

          const tw = tip.offsetWidth;
          if (tipLeft + tw > window.innerWidth - edge) {
            tip.style.left = `${Math.max(edge, window.innerWidth - tw - edge)}px`;
          }
        };

        syncInspectOverlay();
        requestAnimationFrame(() => syncInspectOverlay?.());

        const seenScroll = new Set<HTMLElement>();
        for (const c of collectScrollContainers(target)) {
          if (seenScroll.has(c)) continue;
          seenScroll.add(c);
          scrollContainers.push(c);
        }
        for (const c of scrollContainers) {
          c.addEventListener('scroll', syncInspectOverlay, { passive: true });
        }
        window.addEventListener('scroll', syncInspectOverlay, { capture: true, passive: true });
        window.addEventListener('resize', syncInspectOverlay, { passive: true });
        return;
      }
      if (frames++ >= PREVIEW_NAV_MAX_FRAMES) return;
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (syncInspectOverlay) {
        for (const c of scrollContainers) {
          c.removeEventListener('scroll', syncInspectOverlay);
        }
        window.removeEventListener('scroll', syncInspectOverlay, { capture: true });
        window.removeEventListener('resize', syncInspectOverlay);
      }
      removeInspectLayer();
    };
  }, [layoutHighlightFieldPath, layoutPreviewPageIndex, state.definition, state.component, state.theme]);

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
