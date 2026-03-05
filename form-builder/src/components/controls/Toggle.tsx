export interface ToggleProps {
  label: string;
  checked: boolean;
  testId?: string;
  onToggle: (checked: boolean) => void;
}

export function Toggle(props: ToggleProps) {
  return (
    <label class="inspector-toggle">
      <input
        data-testid={props.testId}
        type="checkbox"
        checked={props.checked}
        onChange={(event) => {
          props.onToggle((event.currentTarget as HTMLInputElement).checked);
        }}
      />
      <span>{props.label}</span>
    </label>
  );
}
