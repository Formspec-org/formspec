import { useEffect, useRef } from 'preact/hooks';
import { definition, definitionVersion } from '../state/definition';
import { engine } from '../state/project';
import { selectedPath } from '../state/selection';

export function Preview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<any>(null);

  // On mount, create the web component and append it
  useEffect(() => {
    import('formspec-webcomponent');
    const el = document.createElement('formspec-render');
    el.style.display = 'block';
    el.style.height = '100%';
    el.style.overflow = 'auto';
    el.style.padding = '24px';
    el.style.background = '#fff';
    containerRef.current?.appendChild(el);
    renderRef.current = el;

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

  // Debounced definition sync — runs after every render due to no deps array
  useEffect(() => {
    const _version = definitionVersion.value; // subscribe to version changes
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
