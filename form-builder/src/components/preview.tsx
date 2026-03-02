import { useEffect, useRef } from 'preact/hooks';
import { FormspecRender } from 'formspec-webcomponent';
import { definition, definitionVersion } from '../state/definition';
import { engine } from '../state/project';
import { selectedPath } from '../state/selection';

// Register the custom element once
if (!customElements.get('formspec-render')) {
  customElements.define('formspec-render', FormspecRender);
}

export function Preview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<any>(null);
  const appliedVersion = useRef(-1);

  // On mount, create the web component and append it
  useEffect(() => {
    const el = document.createElement('formspec-render');
    el.style.display = 'block';
    el.style.height = '100%';
    el.style.overflow = 'auto';
    el.style.padding = '24px';
    el.style.background = '#fff';
    containerRef.current?.appendChild(el);
    renderRef.current = el;

    // Click handler: preview -> tree selection
    // Preview data-name uses full dotted paths (e.g. "basicInfo.fullName")
    // but tree selectedPath uses bare item keys (e.g. "fullName")
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element;
      const field = target.closest('[data-name]');
      if (field) {
        const fullPath = field.getAttribute('data-name');
        if (fullPath) {
          const lastSegment = fullPath.includes('.') ? fullPath.split('.').pop()! : fullPath;
          selectedPath.value = lastSegment;
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

  // Subscribe to signals in the render body so Preact re-renders
  // when they change, which re-runs the corresponding useEffects.
  const hasEngine = engine.value !== null;
  const currentVersion = definitionVersion.value;
  const _selectedPath = selectedPath.value;

  // Debounced definition sync — only when version actually changes
  useEffect(() => {
    if (currentVersion === appliedVersion.current) return;
    const def = definition.value;
    const timer = setTimeout(() => {
      if (renderRef.current) {
        try {
          renderRef.current.definition = structuredClone(def);
          appliedVersion.current = currentVersion;
        } catch (_e) {
          // definition may be invalid; ignore
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [currentVersion]);

  // Selection sync: tree -> preview highlight
  useEffect(() => {
    if (!_selectedPath || !renderRef.current) return;

    // selectedPath is a bare key (e.g. "fullName") but preview data-name
    // uses full dotted paths (e.g. "basicInfo.fullName"). Try exact match
    // first, then suffix match for nested fields.
    let el: Element | null = renderRef.current.querySelector(`[data-name="${_selectedPath}"]`);
    if (!el) {
      el = renderRef.current.querySelector(`[data-name$=".${_selectedPath}"]`);
    }
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.classList.add('preview-highlight');

    const fadeTimer = setTimeout(() => {
      el!.classList.add('preview-highlight-fade');
    }, 1000);

    const removeTimer = setTimeout(() => {
      el!.classList.remove('preview-highlight', 'preview-highlight-fade');
    }, 1500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
      el!.classList.remove('preview-highlight', 'preview-highlight-fade');
    };
  }, [_selectedPath]);

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
