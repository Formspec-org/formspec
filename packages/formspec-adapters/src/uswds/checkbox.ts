/** @filedesc USWDS v3 adapter for Checkbox — renders a single boolean usa-checkbox. */
import type { FieldBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { renderUSWDSBooleanControl } from './shared';

export const renderCheckbox: AdapterRenderFn<FieldBehavior> = (
    behavior, parent, actx
) => {
    renderUSWDSBooleanControl(behavior, parent, actx, {
        labelText: behavior.label,
    });
};
