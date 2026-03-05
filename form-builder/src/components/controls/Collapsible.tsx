import type { ComponentChildren } from 'preact';

export interface CollapsibleProps {
  id: string;
  title: string;
  open: boolean;
  summary?: string | null;
  children: ComponentChildren;
  onToggle: (open: boolean) => void;
}

export function Collapsible(props: CollapsibleProps) {
  return (
    <section class="inspector-section" data-testid={`section-${props.id}`}>
      <button
        type="button"
        class="inspector-section__header"
        onClick={() => {
          props.onToggle(!props.open);
        }}
      >
        <span>{props.open ? '▾' : '▸'} {props.title}</span>
        {!props.open && props.summary ? <span class="inspector-section__summary">{props.summary}</span> : null}
      </button>
      {props.open ? <div class="inspector-section__content">{props.children}</div> : null}
    </section>
  );
}
