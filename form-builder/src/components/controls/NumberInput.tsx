export interface NumberInputProps {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  testId?: string;
  onInput: (value: number | undefined) => void;
}

export function NumberInput(props: NumberInputProps) {
  return (
    <label class="inspector-control">
      <span class="inspector-control__label">{props.label}</span>
      <input
        class="inspector-input"
        data-testid={props.testId}
        type="number"
        value={props.value ?? ''}
        min={props.min}
        max={props.max}
        step={props.step}
        onInput={(event) => {
          const raw = (event.currentTarget as HTMLInputElement).value;
          if (raw.trim().length === 0) {
            props.onInput(undefined);
            return;
          }
          const parsed = Number(raw);
          props.onInput(Number.isFinite(parsed) ? parsed : undefined);
        }}
      />
    </label>
  );
}
