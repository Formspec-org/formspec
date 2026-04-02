/** @filedesc USWDS v3 adapter for Toggle — standard usa-checkbox boolean (matches USWDS form patterns). */
import type { ToggleBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { renderUSWDSBooleanControl } from './shared';

export const renderToggle: AdapterRenderFn<ToggleBehavior> = (
    behavior, parent, actx
) => {
    const labelText = behavior.label + (behavior.offLabel ? ` (${behavior.offLabel})` : '');
    renderUSWDSBooleanControl(behavior, parent, actx, {
        labelText,
        isToggle: true,
    });
};
