/** @filedesc Input component plugins: orchestrate behavior hooks with adapter render functions. */
import { ComponentPlugin, RenderContext } from '../types';
import { useTextInput } from '../behaviors/text-input';
import { useNumberInput } from '../behaviors/number-input';
import { useRadioGroup } from '../behaviors/radio-group';
import { useCheckboxGroup } from '../behaviors/checkbox-group';
import { useSelect } from '../behaviors/select';
import { useToggle } from '../behaviors/toggle';
import { useCheckbox } from '../behaviors/checkbox';
import { useDatePicker } from '../behaviors/date-picker';
import { useMoneyInput } from '../behaviors/money-input';
import { useSlider } from '../behaviors/slider';
import { useRating } from '../behaviors/rating';
import { useFileUpload } from '../behaviors/file-upload';
import { useSignature } from '../behaviors/signature';
import { globalRegistry } from '../registry';

/** Renders a text input field via the behavior→adapter pipeline. */
export const TextInputPlugin: ComponentPlugin = {
    type: 'TextInput',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useTextInput(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('TextInput');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders a number input field via the behavior→adapter pipeline. */
export const NumberInputPlugin: ComponentPlugin = {
    type: 'NumberInput',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useNumberInput(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('NumberInput');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders a select dropdown via the behavior→adapter pipeline. */
export const SelectPlugin: ComponentPlugin = {
    type: 'Select',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useSelect(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('Select');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders a toggle switch via the behavior→adapter pipeline. */
export const TogglePlugin: ComponentPlugin = {
    type: 'Toggle',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useToggle(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('Toggle');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders a checkbox input via the behavior→adapter pipeline. */
export const CheckboxPlugin: ComponentPlugin = {
    type: 'Checkbox',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useCheckbox(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('Checkbox');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders a date picker input via the behavior→adapter pipeline. */
export const DatePickerPlugin: ComponentPlugin = {
    type: 'DatePicker',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useDatePicker(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('DatePicker');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders a radio button group via the behavior→adapter pipeline. */
export const RadioGroupPlugin: ComponentPlugin = {
    type: 'RadioGroup',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useRadioGroup(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('RadioGroup');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders a checkbox group via the behavior→adapter pipeline. */
export const CheckboxGroupPlugin: ComponentPlugin = {
    type: 'CheckboxGroup',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useCheckboxGroup(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('CheckboxGroup');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders a range slider via the behavior→adapter pipeline. */
export const SliderPlugin: ComponentPlugin = {
    type: 'Slider',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useSlider(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('Slider');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders an icon-rating control via the behavior→adapter pipeline. */
export const RatingPlugin: ComponentPlugin = {
    type: 'Rating',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useRating(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('Rating');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders a file upload input via the behavior→adapter pipeline. */
export const FileUploadPlugin: ComponentPlugin = {
    type: 'FileUpload',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useFileUpload(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('FileUpload');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders a signature canvas via the behavior→adapter pipeline. */
export const SignaturePlugin: ComponentPlugin = {
    type: 'Signature',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useSignature(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('Signature');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** Renders a money input via the behavior→adapter pipeline. */
export const MoneyInputPlugin: ComponentPlugin = {
    type: 'MoneyInput',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const behavior = useMoneyInput(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('MoneyInput');
        if (adapterFn) adapterFn(behavior, parent, ctx.adapterContext);
    }
};

/** All 13 built-in input component plugins, exported as a single array for bulk registration. */
export const InputPlugins: ComponentPlugin[] = [
    TextInputPlugin,
    NumberInputPlugin,
    SelectPlugin,
    TogglePlugin,
    CheckboxPlugin,
    DatePickerPlugin,
    RadioGroupPlugin,
    CheckboxGroupPlugin,
    SliderPlugin,
    RatingPlugin,
    FileUploadPlugin,
    SignaturePlugin,
    MoneyInputPlugin
];
