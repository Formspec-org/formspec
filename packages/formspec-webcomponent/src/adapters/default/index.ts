/** @filedesc Default render adapter — reproduces the current DOM output. */
import type { RenderAdapter } from '../types';
import { renderTextInput } from './text-input';
import { renderNumberInput } from './number-input';
import { renderRadioGroup } from './radio-group';
import { renderCheckboxGroup } from './checkbox-group';
import { renderSelect } from './select';
import { renderToggle } from './toggle';
import { renderCheckbox } from './checkbox';
import { renderDatePicker } from './date-picker';
import { renderMoneyInput } from './money-input';
import { renderSlider } from './slider';
import { renderRating } from './rating';
import { renderFileUpload } from './file-upload';
import { renderSignature } from './signature';
import { renderWizard } from './wizard';
import { renderTabs } from './tabs';
import {
    renderPage,
    renderStack,
    renderGrid,
    renderDivider,
    renderCollapsible,
    renderColumns,
    renderPanel,
    renderAccordion,
    renderModal,
    renderPopover,
} from './layout';
import {
    renderDefaultHeading,
    renderDefaultText,
    renderDefaultCard,
    renderDefaultSpacer,
    renderDefaultAlert,
    renderDefaultBadge,
    renderDefaultProgressBar,
    renderDefaultSummary,
    renderDefaultValidationSummary,
} from './display-components';
import { renderDefaultConditionalGroup, renderDefaultDataTable } from './special-adapters';

export const defaultAdapter: RenderAdapter = {
    name: 'default',
    components: {
        Page: renderPage,
        Stack: renderStack,
        Grid: renderGrid,
        Divider: renderDivider,
        Collapsible: renderCollapsible,
        Columns: renderColumns,
        Panel: renderPanel,
        Accordion: renderAccordion,
        Modal: renderModal,
        Popover: renderPopover,
        Heading: renderDefaultHeading,
        Text: renderDefaultText,
        Card: renderDefaultCard,
        Spacer: renderDefaultSpacer,
        Alert: renderDefaultAlert,
        Badge: renderDefaultBadge,
        ProgressBar: renderDefaultProgressBar,
        Summary: renderDefaultSummary,
        ValidationSummary: renderDefaultValidationSummary,
        ConditionalGroup: renderDefaultConditionalGroup,
        DataTable: renderDefaultDataTable,
        TextInput: renderTextInput,
        NumberInput: renderNumberInput,
        RadioGroup: renderRadioGroup,
        CheckboxGroup: renderCheckboxGroup,
        Select: renderSelect,
        Toggle: renderToggle,
        Checkbox: renderCheckbox,
        DatePicker: renderDatePicker,
        MoneyInput: renderMoneyInput,
        Slider: renderSlider,
        Rating: renderRating,
        FileUpload: renderFileUpload,
        Signature: renderSignature,
        Wizard: renderWizard,
        Tabs: renderTabs,
    },
};
