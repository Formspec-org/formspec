import { effect } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';

const TextInputPlugin: ComponentPlugin = {
    type: 'TextInput',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
        const el = ctx.renderInputComponent(comp, item, fullName);
        parent.appendChild(el);
    }
};

const NumberInputPlugin: ComponentPlugin = {
    type: 'NumberInput',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
        const el = ctx.renderInputComponent(comp, item, fullName);
        parent.appendChild(el);
    }
};

const SelectPlugin: ComponentPlugin = {
    type: 'Select',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
        const el = ctx.renderInputComponent(comp, item, fullName);
        parent.appendChild(el);
    }
};

const TogglePlugin: ComponentPlugin = {
    type: 'Toggle',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
        const el = ctx.renderInputComponent(comp, item, fullName);
        parent.appendChild(el);
    }
};

const CheckboxPlugin: ComponentPlugin = {
    type: 'Checkbox',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
        const el = ctx.renderInputComponent(comp, item, fullName);
        parent.appendChild(el);
    }
};

const DatePickerPlugin: ComponentPlugin = {
    type: 'DatePicker',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
        const el = ctx.renderInputComponent(comp, item, fullName);
        parent.appendChild(el);
    }
};

const RadioGroupPlugin: ComponentPlugin = {
    type: 'RadioGroup',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
        const el = ctx.renderInputComponent(comp, item, fullName);
        parent.appendChild(el);
    }
};

const CheckboxGroupPlugin: ComponentPlugin = {
    type: 'CheckboxGroup',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
        const el = ctx.renderInputComponent(comp, item, fullName);
        parent.appendChild(el);
    }
};

const SliderPlugin: ComponentPlugin = {
    type: 'Slider',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;

        const wrapper = document.createElement('div');
        wrapper.className = 'formspec-field formspec-slider';
        wrapper.dataset.name = fullName;

        const label = document.createElement('label');
        label.className = 'formspec-label';
        label.textContent = comp.labelOverride || item.label || item.key;
        wrapper.appendChild(label);

        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'formspec-slider-track';

        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'formspec-input';
        input.name = fullName;
        if (comp.min != null) input.min = String(comp.min);
        if (comp.max != null) input.max = String(comp.max);
        if (comp.step != null) input.step = String(comp.step);
        sliderContainer.appendChild(input);

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'formspec-slider-value';
        if (comp.showValue !== false) {
            sliderContainer.appendChild(valueDisplay);
        }

        wrapper.appendChild(sliderContainer);

        input.addEventListener('input', () => {
            const val = input.value === '' ? null : Number(input.value);
            ctx.engine.setValue(fullName, val);
        });

        ctx.cleanupFns.push(effect(() => {
            const sig = ctx.engine.signals[fullName];
            if (!sig) return;
            const val = sig.value;
            if (document.activeElement !== input) input.value = val ?? '';
            valueDisplay.textContent = val != null ? String(val) : '';
        }));

        ctx.cleanupFns.push(effect(() => {
            const isRelevant = ctx.engine.relevantSignals[fullName]?.value ?? true;
            wrapper.classList.toggle('formspec-hidden', !isRelevant);
        }));

        ctx.applyCssClass(wrapper, comp);
        ctx.applyAccessibility(wrapper, comp);
        ctx.applyStyle(wrapper, comp.style);
        parent.appendChild(wrapper);
    }
};

const RatingPlugin: ComponentPlugin = {
    type: 'Rating',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;

        const wrapper = document.createElement('div');
        wrapper.className = 'formspec-field formspec-rating';
        wrapper.dataset.name = fullName;

        const label = document.createElement('label');
        label.className = 'formspec-label';
        label.textContent = comp.labelOverride || item.label || item.key;
        wrapper.appendChild(label);

        const maxRating = comp.max || 5;
        const icon = comp.icon || '\u2605'; // star
        const container = document.createElement('div');
        container.className = 'formspec-rating-stars';

        const stars: HTMLSpanElement[] = [];
        for (let i = 1; i <= maxRating; i++) {
            const star = document.createElement('span');
            star.className = 'formspec-rating-star';
            star.textContent = icon;
            star.dataset.value = String(i);
            star.addEventListener('click', () => {
                ctx.engine.setValue(fullName, i);
            });
            container.appendChild(star);
            stars.push(star);
        }

        wrapper.appendChild(container);

        ctx.cleanupFns.push(effect(() => {
            const sig = ctx.engine.signals[fullName];
            const val = sig?.value ?? 0;
            stars.forEach((star, idx) => {
                star.classList.toggle('formspec-rating-star--selected', (idx + 1) <= val);
            });
        }));

        ctx.cleanupFns.push(effect(() => {
            const isRelevant = ctx.engine.relevantSignals[fullName]?.value ?? true;
            wrapper.classList.toggle('formspec-hidden', !isRelevant);
        }));

        ctx.applyCssClass(wrapper, comp);
        ctx.applyAccessibility(wrapper, comp);
        ctx.applyStyle(wrapper, comp.style);
        parent.appendChild(wrapper);
    }
};

const FileUploadPlugin: ComponentPlugin = {
    type: 'FileUpload',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;

        const wrapper = document.createElement('div');
        wrapper.className = 'formspec-field formspec-file-upload';
        wrapper.dataset.name = fullName;

        const label = document.createElement('label');
        label.className = 'formspec-label';
        label.textContent = comp.labelOverride || item.label || item.key;
        wrapper.appendChild(label);

        const input = document.createElement('input');
        input.type = 'file';
        input.className = 'formspec-input';
        input.name = fullName;
        if (comp.accept) input.accept = comp.accept;
        if (comp.multiple) input.multiple = true;

        input.addEventListener('change', () => {
            const files = Array.from(input.files || []);
            const fileData = files.map(f => ({ name: f.name, size: f.size, type: f.type }));
            ctx.engine.setValue(fullName, comp.multiple ? fileData : fileData[0] || null);
        });

        if (comp.dragDrop) {
            const dropZone = document.createElement('div');
            dropZone.className = 'formspec-drop-zone';
            dropZone.textContent = 'Drop files here or click to browse';

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('formspec-drop-zone--active');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('formspec-drop-zone--active');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('formspec-drop-zone--active');
                const files = Array.from(e.dataTransfer?.files || []);
                const fileData = files.map(f => ({ name: f.name, size: f.size, type: f.type }));
                ctx.engine.setValue(fullName, comp.multiple ? fileData : fileData[0] || null);
            });
            dropZone.addEventListener('click', () => input.click());

            input.hidden = true;
            wrapper.appendChild(dropZone);
            wrapper.appendChild(input);
        } else {
            wrapper.appendChild(input);
        }

        ctx.cleanupFns.push(effect(() => {
            const isRelevant = ctx.engine.relevantSignals[fullName]?.value ?? true;
            wrapper.classList.toggle('formspec-hidden', !isRelevant);
        }));

        ctx.applyCssClass(wrapper, comp);
        ctx.applyAccessibility(wrapper, comp);
        ctx.applyStyle(wrapper, comp.style);
        parent.appendChild(wrapper);
    }
};

const SignaturePlugin: ComponentPlugin = {
    type: 'Signature',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;

        const wrapper = document.createElement('div');
        wrapper.className = 'formspec-field formspec-signature';
        wrapper.dataset.name = fullName;

        const label = document.createElement('label');
        label.className = 'formspec-label';
        label.textContent = comp.labelOverride || item.label || item.key;
        wrapper.appendChild(label);

        const canvas = document.createElement('canvas');
        canvas.className = 'formspec-signature-canvas';
        canvas.width = 400;
        canvas.height = comp.height || 200;
        wrapper.appendChild(canvas);

        const canvasCtx = canvas.getContext('2d')!;
        const strokeColor = comp.strokeColor || '#000';
        let drawing = false;

        const getPos = (e: MouseEvent | Touch) => {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };

        canvas.addEventListener('mousedown', (e) => {
            drawing = true;
            const pos = getPos(e);
            canvasCtx.beginPath();
            canvasCtx.moveTo(pos.x, pos.y);
        });
        canvas.addEventListener('mousemove', (e) => {
            if (!drawing) return;
            const pos = getPos(e);
            canvasCtx.lineTo(pos.x, pos.y);
            canvasCtx.strokeStyle = strokeColor;
            canvasCtx.lineWidth = 2;
            canvasCtx.stroke();
        });
        canvas.addEventListener('mouseup', () => {
            drawing = false;
            ctx.engine.setValue(fullName, canvas.toDataURL());
        });
        canvas.addEventListener('mouseleave', () => { drawing = false; });

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = 'Clear';
        clearBtn.className = 'formspec-signature-clear';
        clearBtn.addEventListener('click', () => {
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.engine.setValue(fullName, null);
        });
        wrapper.appendChild(clearBtn);

        ctx.cleanupFns.push(effect(() => {
            const isRelevant = ctx.engine.relevantSignals[fullName]?.value ?? true;
            wrapper.classList.toggle('formspec-hidden', !isRelevant);
        }));

        ctx.applyCssClass(wrapper, comp);
        ctx.applyAccessibility(wrapper, comp);
        ctx.applyStyle(wrapper, comp.style);
        parent.appendChild(wrapper);
    }
};

const MoneyInputPlugin: ComponentPlugin = {
    type: 'MoneyInput',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;
        const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
        const el = ctx.renderInputComponent({ ...comp, component: 'NumberInput' }, { ...item, dataType: 'money' }, fullName);
        parent.appendChild(el);
    }
};

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
