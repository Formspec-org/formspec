interface ColorPickerProps {
  label: string;
  value?: string;
  testId?: string;
  swatchTestId?: string;
  onInput: (value: string) => void;
}

const FALLBACK_SWATCH = '#0f766e';

export function ColorPicker(props: ColorPickerProps) {
  const rawValue = props.value ?? '';
  const swatchValue = normalizeSwatch(rawValue);

  return (
    <div class="inspector-control">
      <label class="inspector-control__label">{props.label}</label>
      <div class="brand-color-picker">
        <input
          class="brand-color-picker__swatch"
          type="color"
          value={swatchValue}
          data-testid={props.swatchTestId}
          onInput={(event) => {
            props.onInput((event.currentTarget as HTMLInputElement).value);
          }}
        />
        <input
          class="inspector-input brand-color-picker__text"
          type="text"
          value={rawValue}
          placeholder="#0F766E"
          data-testid={props.testId}
          onInput={(event) => {
            props.onInput((event.currentTarget as HTMLInputElement).value);
          }}
        />
      </div>
    </div>
  );
}

function normalizeSwatch(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : FALLBACK_SWATCH;
}
