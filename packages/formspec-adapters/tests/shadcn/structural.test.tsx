/** @filedesc Structural DOM tests for the shadcn/React adapter — all 15 components. */
import { describe, it, expect, beforeAll } from 'vitest';
import {
    mockTextInput, mockNumberInput, mockRadioGroup, mockCheckboxGroup,
    mockSelect, mockDatePicker, mockFieldBehavior, mockToggle,
    mockMoneyInput, mockSlider, mockRating, mockFileUpload,
    mockSignature, mockWizard, mockTabs, mockAdapterContext, captureBindRefs,
    mockCanvasContext,
} from '../helpers';

beforeAll(() => { mockCanvasContext(); });

// ── Helpers ────────────────────────────────────────────────────────

function makeParent(): HTMLElement { return document.createElement('div'); }

// ── Factory ────────────────────────────────────────────────────────

describe('createReactAdapter factory', () => {
    it('mounts a React component into the parent element', async () => {
        const { createReactAdapter } = await import('../../src/shadcn/factory');
        const React = await import('react');

        const TestComponent = ({ behavior }: { behavior: any }) =>
            React.createElement('div', { 'data-testid': 'mounted' }, behavior.label);

        const adapterFn = createReactAdapter(TestComponent);
        const parent = makeParent();
        const actx = mockAdapterContext();

        adapterFn(mockFieldBehavior(), parent, actx);

        expect(parent.querySelector('[data-testid="mounted"]')).toBeTruthy();
        expect(parent.querySelector('[data-testid="mounted"]')!.textContent).toBe('I agree');
    });

    it('registers unmount on actx.onDispose', async () => {
        const { createReactAdapter } = await import('../../src/shadcn/factory');
        const React = await import('react');

        const TestComponent = ({ behavior }: { behavior: any }) =>
            React.createElement('span', null, 'hello');

        const adapterFn = createReactAdapter(TestComponent);
        const parent = makeParent();
        const actx = mockAdapterContext();

        adapterFn(mockFieldBehavior(), parent, actx);
        expect(actx.onDispose).toHaveBeenCalledOnce();
        expect(parent.querySelector('span')).toBeTruthy();

        // Calling the dispose function should unmount
        const disposeFn = (actx.onDispose as any).mock.calls[0][0];
        disposeFn();
        expect(parent.innerHTML).toBe('');
    });

    it('renders multiple fields into the same parent without clobbering', async () => {
        const { createReactAdapter } = await import('../../src/shadcn/factory');
        const React = await import('react');

        const FieldA = ({ behavior }: { behavior: any }) =>
            React.createElement('div', { 'data-testid': 'a' }, 'Field A');
        const FieldB = ({ behavior }: { behavior: any }) =>
            React.createElement('div', { 'data-testid': 'b' }, 'Field B');

        const renderA = createReactAdapter(FieldA);
        const renderB = createReactAdapter(FieldB);
        const parent = makeParent();
        const actx = mockAdapterContext();

        renderA(mockFieldBehavior(), parent, actx);
        renderB(mockFieldBehavior(), parent, actx);

        // Both fields must be present in the DOM
        expect(parent.querySelector('[data-testid="a"]')).toBeTruthy();
        expect(parent.querySelector('[data-testid="b"]')).toBeTruthy();
        expect(parent.children.length).toBe(2);
    });
});

// ── TextInput ──────────────────────────────────────────────────────

describe('shadcn TextInput', () => {
    let renderTextInput: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/text-input');
        renderTextInput = mod.renderTextInput;
    });

    it('renders label, input, and error elements with shadcn classes', () => {
        const parent = makeParent();
        renderTextInput(mockTextInput(), parent, mockAdapterContext());

        const root = parent.querySelector('[data-name="name"]')!;
        expect(root).toBeTruthy();

        const label = root.querySelector('label')!;
        expect(label).toBeTruthy();
        expect(label.textContent).toBe('Full Name');
        expect(label.className).toContain('text-sm');
        expect(label.className).toContain('font-medium');

        const input = root.querySelector('input')!;
        expect(input).toBeTruthy();
        expect(input.type).toBe('text');
        expect(input.className).toContain('rounded-md');
        expect(input.className).toContain('border-input');

        const error = root.querySelector('[role="alert"]')!;
        expect(error).toBeTruthy();
        expect(error.className).toContain('text-destructive');
    });

    it('renders textarea when maxLines > 1', () => {
        const parent = makeParent();
        renderTextInput(mockTextInput({ maxLines: 5 }), parent, mockAdapterContext());
        expect(parent.querySelector('textarea')).toBeTruthy();
        expect(parent.querySelector('input')).toBeNull();
    });

    it('hides label with sr-only when labelPosition is hidden', () => {
        const parent = makeParent();
        renderTextInput(
            mockTextInput({ presentation: { labelPosition: 'hidden' } as any }),
            parent, mockAdapterContext()
        );
        const label = parent.querySelector('label')!;
        expect(label.classList.contains('sr-only')).toBe(true);
    });

    it('calls bind() with correct FieldRefs and registers dispose', () => {
        const parent = makeParent();
        const actx = mockAdapterContext();
        const b = mockTextInput();
        renderTextInput(b, parent, actx);

        expect(b.bind).toHaveBeenCalledOnce();
        expect(actx.onDispose).toHaveBeenCalled();

        const refs = captureBindRefs(b);
        expect(refs.root).toBeTruthy();
        expect(refs.label).toBeTruthy();
        expect(refs.control).toBeTruthy();
        expect(refs.error).toBeTruthy();
        expect(typeof refs.onValidationChange).toBe('function');
    });

    it('onValidationChange toggles destructive border class', () => {
        const parent = makeParent();
        const b = mockTextInput();
        renderTextInput(b, parent, mockAdapterContext());

        const refs = captureBindRefs(b);
        const input = parent.querySelector('input')!;

        refs.onValidationChange!(true, 'Required');
        expect(input.className).toContain('border-destructive');

        refs.onValidationChange!(false, '');
        expect(input.className).not.toContain('border-destructive');
    });

    it('renders hint when provided', () => {
        const parent = makeParent();
        renderTextInput(mockTextInput({ hint: 'Enter full name' }), parent, mockAdapterContext());
        const hint = parent.querySelector(`[id="field-name-hint"]`)!;
        expect(hint).toBeTruthy();
        expect(hint.textContent).toBe('Enter full name');
        expect(hint.className).toContain('text-muted-foreground');
    });
});

// ── NumberInput ────────────────────────────────────────────────────

describe('shadcn NumberInput', () => {
    let renderNumberInput: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/number-input');
        renderNumberInput = mod.renderNumberInput;
    });

    it('renders input with type=number and constraints', () => {
        const parent = makeParent();
        renderNumberInput(mockNumberInput({ min: 0, max: 120, step: 1 }), parent, mockAdapterContext());
        const input = parent.querySelector('input') as HTMLInputElement;
        expect(input).toBeTruthy();
        expect(input.type).toBe('number');
        expect(input.min).toBe('0');
        expect(input.max).toBe('120');
        expect(input.className).toContain('rounded-md');
    });

    it('calls bind() and registers dispose', () => {
        const parent = makeParent();
        const actx = mockAdapterContext();
        const b = mockNumberInput();
        renderNumberInput(b, parent, actx);
        expect(b.bind).toHaveBeenCalledOnce();
        expect(actx.onDispose).toHaveBeenCalled();
    });
});

// ── RadioGroup ─────────────────────────────────────────────────────

describe('shadcn RadioGroup', () => {
    let renderRadioGroup: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/radio-group');
        renderRadioGroup = mod.renderRadioGroup;
    });

    it('renders fieldset with radio options', () => {
        const parent = makeParent();
        renderRadioGroup(mockRadioGroup(), parent, mockAdapterContext());

        expect(parent.querySelector('fieldset')).toBeTruthy();
        expect(parent.querySelector('legend')).toBeTruthy();
        const radios = parent.querySelectorAll('input[type="radio"]');
        expect(radios.length).toBe(2);
    });

    it('passes optionControls and rebuildOptions to bind()', () => {
        const parent = makeParent();
        const b = mockRadioGroup();
        renderRadioGroup(b, parent, mockAdapterContext());
        const refs = captureBindRefs(b);
        expect(refs.optionControls).toBeTruthy();
        expect(refs.optionControls!.size).toBe(2);
        expect(typeof refs.rebuildOptions).toBe('function');
    });
});

// ── CheckboxGroup ──────────────────────────────────────────────────

describe('shadcn CheckboxGroup', () => {
    let renderCheckboxGroup: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/checkbox-group');
        renderCheckboxGroup = mod.renderCheckboxGroup;
    });

    it('renders fieldset with checkbox options', () => {
        const parent = makeParent();
        renderCheckboxGroup(mockCheckboxGroup(), parent, mockAdapterContext());
        expect(parent.querySelector('fieldset')).toBeTruthy();
        const checkboxes = parent.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(2);
    });

    it('renders select-all checkbox when selectAll is true', () => {
        const parent = makeParent();
        renderCheckboxGroup(mockCheckboxGroup({ selectAll: true }), parent, mockAdapterContext());
        const checkboxes = parent.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(3);
    });
});

// ── Select ─────────────────────────────────────────────────────────

describe('shadcn Select', () => {
    let renderSelect: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/select');
        renderSelect = mod.renderSelect;
    });

    it('renders styled select with options', () => {
        const parent = makeParent();
        renderSelect(mockSelect(), parent, mockAdapterContext());
        const select = parent.querySelector('select') as HTMLSelectElement;
        expect(select).toBeTruthy();
        expect(select.className).toContain('rounded-md');
        // placeholder + 2 options = 3
        expect(select.options.length).toBe(3);
    });

    it('passes rebuildOptions to bind()', () => {
        const parent = makeParent();
        const b = mockSelect();
        renderSelect(b, parent, mockAdapterContext());
        const refs = captureBindRefs(b);
        expect(typeof refs.rebuildOptions).toBe('function');
    });
});

// ── DatePicker ─────────────────────────────────────────────────────

describe('shadcn DatePicker', () => {
    let renderDatePicker: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/date-picker');
        renderDatePicker = mod.renderDatePicker;
    });

    it('renders input with type=date', () => {
        const parent = makeParent();
        renderDatePicker(mockDatePicker(), parent, mockAdapterContext());
        const input = parent.querySelector('input') as HTMLInputElement;
        expect(input).toBeTruthy();
        expect(input.type).toBe('date');
        expect(input.className).toContain('rounded-md');
    });
});

// ── Checkbox ───────────────────────────────────────────────────────

describe('shadcn Checkbox', () => {
    let renderCheckbox: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/checkbox');
        renderCheckbox = mod.renderCheckbox;
    });

    it('renders checkbox input with label', () => {
        const parent = makeParent();
        renderCheckbox(mockFieldBehavior(), parent, mockAdapterContext());
        const input = parent.querySelector('input[type="checkbox"]')!;
        expect(input).toBeTruthy();
        expect(input.className).toContain('rounded-sm');
        expect(parent.querySelector('label')!.textContent).toContain('I agree');
    });
});

// ── Toggle ─────────────────────────────────────────────────────────

describe('shadcn Toggle', () => {
    let renderToggle: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/toggle');
        renderToggle = mod.renderToggle;
    });

    it('renders toggle switch', () => {
        const parent = makeParent();
        renderToggle(mockToggle(), parent, mockAdapterContext());
        const input = parent.querySelector('input[type="checkbox"]')!;
        expect(input).toBeTruthy();
        expect(parent.querySelector('[role="switch"]')).toBeTruthy();
    });
});

// ── MoneyInput ─────────────────────────────────────────────────────

describe('shadcn MoneyInput', () => {
    let renderMoneyInput: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/money-input');
        renderMoneyInput = mod.renderMoneyInput;
    });

    it('renders input with currency prefix', () => {
        const parent = makeParent();
        renderMoneyInput(mockMoneyInput(), parent, mockAdapterContext());
        expect(parent.textContent).toContain('$');
        expect(parent.querySelector('input[type="number"]')).toBeTruthy();
    });

    it('renders currency input when no resolvedCurrency', () => {
        const parent = makeParent();
        renderMoneyInput(mockMoneyInput({ resolvedCurrency: null }), parent, mockAdapterContext());
        const inputs = parent.querySelectorAll('input');
        expect(inputs.length).toBeGreaterThanOrEqual(2);
    });
});

// ── Slider ─────────────────────────────────────────────────────────

describe('shadcn Slider', () => {
    let renderSlider: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/slider');
        renderSlider = mod.renderSlider;
    });

    it('renders range input', () => {
        const parent = makeParent();
        renderSlider(mockSlider(), parent, mockAdapterContext());
        const input = parent.querySelector('input[type="range"]') as HTMLInputElement;
        expect(input).toBeTruthy();
    });
});

// ── Rating ─────────────────────────────────────────────────────────

describe('shadcn Rating', () => {
    let renderRating: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/rating');
        renderRating = mod.renderRating;
    });

    it('renders star spans with ARIA slider', () => {
        const parent = makeParent();
        renderRating(mockRating(), parent, mockAdapterContext());
        expect(parent.querySelectorAll('.formspec-rating-star').length).toBe(5);
        expect(parent.querySelector('[role="slider"]')).toBeTruthy();
    });
});

// ── FileUpload ─────────────────────────────────────────────────────

describe('shadcn FileUpload', () => {
    let renderFileUpload: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/file-upload');
        renderFileUpload = mod.renderFileUpload;
    });

    it('renders file input with drop zone', () => {
        const parent = makeParent();
        renderFileUpload(mockFileUpload(), parent, mockAdapterContext());
        expect(parent.querySelector('input[type="file"]')).toBeTruthy();
        expect(parent.querySelector('[class*="border-dashed"]')).toBeTruthy();
    });
});

// ── Signature ──────────────────────────────────────────────────────

describe('shadcn Signature', () => {
    let renderSignature: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/signature');
        renderSignature = mod.renderSignature;
    });

    it('renders canvas and clear button', () => {
        const parent = makeParent();
        renderSignature(mockSignature(), parent, mockAdapterContext());
        expect(parent.querySelector('canvas')).toBeTruthy();
        const clearBtn = parent.querySelector('button')!;
        expect(clearBtn).toBeTruthy();
        expect(clearBtn.textContent).toBe('Clear');
    });
});

// ── Wizard ──────────────────────────────────────────────────────────

describe('shadcn Wizard', () => {
    let renderWizard: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/wizard');
        renderWizard = mod.renderWizard;
    });

    it('renders wizard with progress and panels', () => {
        const parent = makeParent();
        renderWizard(mockWizard(), parent, mockAdapterContext());
        expect(parent.querySelector('.formspec-wizard')).toBeTruthy();
        expect(parent.querySelectorAll('.formspec-wizard-panel').length).toBe(2);
    });

    it('renders prev/next navigation buttons', () => {
        const parent = makeParent();
        renderWizard(mockWizard(), parent, mockAdapterContext());
        const buttons = parent.querySelectorAll('button');
        expect(buttons.length).toBeGreaterThanOrEqual(2);
        const texts = Array.from(buttons).map(b => b.textContent);
        expect(texts).toContain('Previous');
        expect(texts).toContain('Next');
    });
});

// ── Tabs ────────────────────────────────────────────────────────────

describe('shadcn Tabs', () => {
    let renderTabs: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/tabs');
        renderTabs = mod.renderTabs;
    });

    it('renders tab bar with role=tablist', () => {
        const parent = makeParent();
        renderTabs(mockTabs(), parent, mockAdapterContext());
        expect(parent.querySelector('[role="tablist"]')).toBeTruthy();
        const tabs = parent.querySelectorAll('[role="tab"]');
        expect(tabs.length).toBe(2);
    });

    it('renders tab panels with correct ARIA', () => {
        const parent = makeParent();
        renderTabs(mockTabs(), parent, mockAdapterContext());
        const panels = parent.querySelectorAll('[role="tabpanel"]');
        expect(panels.length).toBe(2);
    });
});

// ── Adapter shape ──────────────────────────────────────────────────

describe('shadcnAdapter shape', () => {
    it('exports all 15 component render functions', async () => {
        const { shadcnAdapter } = await import('../../src/shadcn/index');
        expect(shadcnAdapter.name).toBe('shadcn');
        const expected = [
            'TextInput', 'NumberInput', 'RadioGroup', 'CheckboxGroup', 'Select',
            'DatePicker', 'Checkbox', 'Toggle', 'MoneyInput', 'Slider',
            'Rating', 'FileUpload', 'Signature', 'Wizard', 'Tabs',
        ];
        for (const name of expected) {
            expect(shadcnAdapter.components[name], `Missing component: ${name}`).toBeDefined();
        }
    });
});

// ── Cascade obligations ────────────────────────────────────────────

describe('shadcn cascade obligations', () => {
    let renderTextInput: any;
    beforeAll(async () => {
        const mod = await import('../../src/shadcn/text-input');
        renderTextInput = mod.renderTextInput;
    });

    it('applies cssClass from presentation to root', () => {
        const parent = makeParent();
        const b = mockTextInput({ presentation: { cssClass: 'custom-theme-class' } as any });
        renderTextInput(b, parent, mockAdapterContext());
        const root = parent.querySelector('[data-name="name"]')!;
        expect(root.classList.contains('custom-theme-class')).toBe(true);
    });

    it('applies accessibility attrs from presentation to root', () => {
        const parent = makeParent();
        const b = mockTextInput({
            presentation: {
                accessibility: { role: 'region', description: 'Important field' }
            } as any,
        });
        renderTextInput(b, parent, mockAdapterContext());
        const root = parent.querySelector('[data-name="name"]')!;
        expect(root.getAttribute('role')).toBe('region');
        expect(root.getAttribute('aria-description')).toBe('Important field');
    });
});
