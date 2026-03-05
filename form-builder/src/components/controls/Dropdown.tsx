export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  label: string;
  value: string | undefined;
  options: DropdownOption[];
  disabled?: boolean;
  testId?: string;
  onChange: (value: string) => void;
}

export function Dropdown(props: DropdownProps) {
  return (
    <label class="inspector-control">
      <span class="inspector-control__label">{props.label}</span>
      <select
        class="inspector-input"
        data-testid={props.testId}
        value={props.value ?? ''}
        disabled={props.disabled}
        onChange={(event) => {
          props.onChange((event.currentTarget as HTMLSelectElement).value);
        }}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
