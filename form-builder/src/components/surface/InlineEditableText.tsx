import type { Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface InlineEditableTextProps {
  value?: string;
  placeholder: string;
  className: string;
  multiline?: boolean;
  testIdPrefix: string;
  startEditingToken?: number;
  editEnabled?: boolean;
  onInput?: (value: string) => void;
  onCommit: (value: string) => void;
}

export function InlineEditableText(props: InlineEditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.value ?? '');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const lastStartTokenRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!editing) {
      setDraft(props.value ?? '');
    }
  }, [editing, props.value]);

  useEffect(() => {
    if (!editing || !inputRef.current) {
      return;
    }
    inputRef.current.focus();
    if ('select' in inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (props.startEditingToken === undefined) {
      return;
    }
    if (props.startEditingToken === lastStartTokenRef.current) {
      return;
    }
    lastStartTokenRef.current = props.startEditingToken;
    setEditing(true);
  }, [props.startEditingToken]);

  const commit = (nextValue?: string) => {
    setEditing(false);
    props.onCommit(nextValue ?? draft);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(props.value ?? '');
  };

  if (editing) {
    if (props.multiline) {
      return (
        <textarea
          ref={inputRef as Ref<HTMLTextAreaElement>}
          class={`${props.className} is-editing`}
          data-testid={`${props.testIdPrefix}-input`}
          value={draft}
          rows={2}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onInput={(event) => {
            const next = (event.currentTarget as HTMLTextAreaElement).value;
            setDraft(next);
            props.onInput?.(next);
          }}
          onBlur={(event) => {
            commit((event.currentTarget as HTMLTextAreaElement).value);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              commit();
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
          }}
        />
      );
    }

    return (
      <input
        ref={inputRef as Ref<HTMLInputElement>}
        class={`${props.className} is-editing`}
        data-testid={`${props.testIdPrefix}-input`}
        type="text"
        value={draft}
        onClick={(event) => {
          event.stopPropagation();
        }}
        onInput={(event) => {
          const next = (event.currentTarget as HTMLInputElement).value;
          setDraft(next);
          props.onInput?.(next);
        }}
        onBlur={(event) => {
          commit((event.currentTarget as HTMLInputElement).value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      class={`${props.className}${props.value?.trim() ? '' : ' is-placeholder'}${props.editEnabled ? ' is-edit-enabled' : ''}`}
      data-testid={`${props.testIdPrefix}-display`}
      title="Click to edit"
      onClick={(event) => {
        event.stopPropagation();
        setEditing(true);
      }}
    >
      {props.value?.trim() ? props.value : props.placeholder}
    </button>
  );
}
