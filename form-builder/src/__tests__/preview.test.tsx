import { render } from 'preact';
import { Preview } from '../components/preview';

// Mock formspec-webcomponent to avoid browser-only custom element registration
vi.mock('formspec-webcomponent', () => ({}));

// Mock state modules with simple signal-like objects (plain objects with .value)
vi.mock('../state/definition', () => ({
  definition: { value: { items: [], title: 'Test', $formspec: '1.0' } },
  definitionVersion: { value: 0 },
}));

vi.mock('../state/project', () => ({
  engine: { value: null },
  diagnostics: { value: [] },
  activeArtifact: { value: 'definition' },
  editorMode: { value: 'guided' },
}));

vi.mock('../state/selection', () => ({
  selectedPath: { value: null },
  inlineAddState: { value: null },
}));

describe('Preview', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders a preview-container div', () => {
    render(<Preview />, container);
    const previewContainer = container.querySelector('.preview-container');
    expect(previewContainer).not.toBeNull();
  });

  it('shows error message when engine is null', async () => {
    const { engine } = await import('../state/project');
    engine.value = null;

    render(<Preview />, container);
    const errorEl = container.querySelector('.preview-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('Fix definition errors');
  });

  it('does not show error message when engine is set', async () => {
    const { engine } = await import('../state/project');
    engine.value = {} as any;

    render(<Preview />, container);
    const errorEl = container.querySelector('.preview-error');
    expect(errorEl).toBeNull();

    // Reset
    engine.value = null;
  });
});
