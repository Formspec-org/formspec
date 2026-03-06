interface TextInputProps {
  label: string;
  value: string | undefined;
  placeholder?: string;
  testId?: string;
  onInput: (value: string) => void;
}

export function TextInput(props: TextInputProps) {
  return (
    <label class="inspector-control">
      <span class="inspector-control__label">{props.label}</span>
      <input
        class="inspector-input"
        data-testid={props.testId}
        type="text"
        value={props.value ?? ''}
        placeholder={props.placeholder}
        onInput={(event) => {
          props.onInput((event.currentTarget as HTMLInputElement).value);
        }}
      />
    </label>
  );
}
