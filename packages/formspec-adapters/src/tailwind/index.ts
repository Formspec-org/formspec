/** @filedesc Tailwind CSS render adapter — utility-first styling on semantic HTML elements. */
import type { RenderAdapter } from 'formspec-webcomponent';
import { renderTextInput } from './text-input';
import { renderNumberInput } from './number-input';
import { renderRadioGroup } from './radio-group';
import { renderCheckboxGroup } from './checkbox-group';
import { renderSelect } from './select';
import { renderDatePicker } from './date-picker';
import { renderCheckbox } from './checkbox';
import { renderToggle } from './toggle';
import { renderMoneyInput } from './money-input';
import { renderSlider } from './slider';
import { renderRating } from './rating';
import { renderFileUpload } from './file-upload';
import { renderSignature } from './signature';
import { renderWizard } from './wizard';
import { renderTabs } from './tabs';
import { integrationCSS } from './integration-css';

/**
 * Tailwind CSS adapter for formspec-webcomponent.
 *
 * Emits semantic HTML with Tailwind utility classes.
 * Requires Tailwind CSS to be loaded (CDN or built).
 * Does NOT require any JavaScript framework — bind() replaces it.
 */
export const tailwindAdapter: RenderAdapter = {
    name: 'tailwind',
    integrationCSS,
    components: {
        TextInput: renderTextInput,
        NumberInput: renderNumberInput,
        RadioGroup: renderRadioGroup,
        CheckboxGroup: renderCheckboxGroup,
        Select: renderSelect,
        DatePicker: renderDatePicker,
        Checkbox: renderCheckbox,
        Toggle: renderToggle,
        MoneyInput: renderMoneyInput,
        Slider: renderSlider,
        Rating: renderRating,
        FileUpload: renderFileUpload,
        Signature: renderSignature,
        Wizard: renderWizard,
        Tabs: renderTabs,
    },
};
