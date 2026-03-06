import { getSortedBreakpointEntries } from '../../state/project';

interface BreakpointBarProps {
  previewWidth: number;
  activeBreakpoint: string;
  breakpoints: Record<string, number>;
  onPreviewWidthInput: (width: number) => void;
  onActiveBreakpointInput: (breakpointName: string) => void;
  onBreakpointWidthInput: (breakpointName: string, width: number) => void;
}

export function BreakpointBar(props: BreakpointBarProps) {
  const breakpointEntries = getSortedBreakpointEntries(props.breakpoints);
  const minSlider = Math.min(320, ...breakpointEntries.map(([, width]) => width));
  const maxSlider = Math.max(1440, props.previewWidth, ...breakpointEntries.map(([, width]) => width));

  return (
    <div class="breakpoint-bar" data-testid="breakpoint-bar">
      <label class="breakpoint-bar__label" for="breakpoint-width-slider">
        Preview width
      </label>
      <input
        id="breakpoint-width-slider"
        class="breakpoint-bar__slider"
        data-testid="breakpoint-width-slider"
        type="range"
        min={minSlider}
        max={maxSlider}
        step={1}
        value={props.previewWidth}
        onInput={(event) => {
          props.onPreviewWidthInput(Number((event.currentTarget as HTMLInputElement).value));
        }}
      />
      <div class="breakpoint-bar__meta">
        <span class="breakpoint-bar__active" data-testid="breakpoint-active-label">
          {props.activeBreakpoint} · {props.previewWidth}px
        </span>
        <label class="breakpoint-bar__width-field" for="breakpoint-width-input">
          <span>Min width</span>
          <input
            id="breakpoint-width-input"
            class="breakpoint-bar__width-input"
            data-testid="breakpoint-width-input"
            type="number"
            min={0}
            step={1}
            value={props.breakpoints[props.activeBreakpoint] ?? ''}
            onInput={(event) => {
              const raw = Number((event.currentTarget as HTMLInputElement).value);
              if (Number.isFinite(raw)) {
                props.onBreakpointWidthInput(props.activeBreakpoint, raw);
              }
            }}
          />
        </label>
        <div class="breakpoint-bar__snaps">
          {breakpointEntries.map(([name, width]) => (
            <button
              key={name}
              type="button"
              class={`breakpoint-bar__snap${name === props.activeBreakpoint ? ' is-active' : ''}`}
              data-testid={`breakpoint-snap-${name}`}
              onClick={() => {
                props.onActiveBreakpointInput(name);
                props.onPreviewWidthInput(width);
              }}
            >
              {name} {width}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
