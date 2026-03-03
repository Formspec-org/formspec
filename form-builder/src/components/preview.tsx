import { useEffect, useRef } from 'preact/hooks';
import { FormspecRender } from 'formspec-webcomponent';
import { definition, definitionVersion } from '../state/definition';
import { engine } from '../state/project';
import { selectedPath } from '../state/selection';
import uswdsTheme from '../../../packages/formspec-webcomponent/examples/uswds-theme.json';

if (!customElements.get('formspec-render')) {
  customElements.define('formspec-render', FormspecRender);
}

const previewTheme = {
  ...uswdsTheme,
  stylesheets: ['/assets/formspec-uswds-bridge.css'],
};

export function Preview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<any>(null);

  // On mount, create the web component and append it
  useEffect(() => {
    const el = document.createElement('formspec-render') as any;
    containerRef.current?.appendChild(el);
    renderRef.current = el;
    el.themeDocument = previewTheme;

    // Click handler: preview -> tree selection
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element;
      const field = target.closest('[data-name]');
      if (field) {
        const name = field.getAttribute('data-name');
        if (name) {
          selectedPath.value = name;
        }
      }
    };
    el.addEventListener('click', handleClick);

    return () => {
      el.removeEventListener('click', handleClick);
      el.remove();
      renderRef.current = null;
    };
  }, []);

  // Debounced definition sync
  useEffect(() => {
    const _version = definitionVersion.value;
    const def = definition.value;
    const timer = setTimeout(() => {
      if (renderRef.current) {
        try {
          renderRef.current.definition = structuredClone(def);
        } catch (_e) {
          // definition may be invalid; ignore
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  });

  // Selection sync: tree -> preview highlight
  useEffect(() => {
    const path = selectedPath.value;
    if (!path || !renderRef.current) return;

    const el = renderRef.current.querySelector(`[data-name="${path}"]`);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.classList.add('preview-highlight');

    const fadeTimer = setTimeout(() => {
      el.classList.add('preview-highlight-fade');
    }, 1000);

    const removeTimer = setTimeout(() => {
      el.classList.remove('preview-highlight', 'preview-highlight-fade');
    }, 1500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
      el.classList.remove('preview-highlight', 'preview-highlight-fade');
    };
  });

  const hasEngine = engine.value !== null;

  return (
    <div ref={containerRef} class="preview-container">
      {!hasEngine && (
        <div class="preview-error">
          Fix definition errors to see preview
        </div>
      )}
    </div>
  );
}
