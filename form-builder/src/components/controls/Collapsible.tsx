import type { ComponentChildren } from 'preact';

export interface CollapsibleProps {
  id: string;
  title: string;
  open: boolean;
  summary?: string | null;
  children: ComponentChildren;
  /**
   * When false, children are unmounted when closed (useful for expensive or dynamic sections).
   * Defaults to true — children stay in the DOM (hidden via CSS) so they are always queryable.
   */
  keepMounted?: boolean;
  onToggle: (open: boolean) => void;
}

export function Collapsible(props: CollapsibleProps) {
  const keepMounted = props.keepMounted !== false;

  return (
    <section class="inspector-section" data-testid={`section-${props.id}`}>
      <button
        type="button"
        class="inspector-section__header"
        aria-expanded={props.open}
        onClick={() => {
          props.onToggle(!props.open);
        }}
      >
        <span>{props.open ? '▾' : '▸'} {props.title}</span>
        {!props.open && props.summary ? <span class="inspector-section__summary">{props.summary}</span> : null}
      </button>
      {keepMounted ? (
        <div
          class={`inspector-section__content${props.open ? '' : ' inspector-section__content--collapsed'}`}
          aria-hidden={!props.open}
        >
          {props.children}
        </div>
      ) : (
        props.open ? <div class="inspector-section__content">{props.children}</div> : null
      )}
    </section>
  );
}
