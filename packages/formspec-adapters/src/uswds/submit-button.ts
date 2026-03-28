/** @filedesc USWDS v3 adapter for SubmitButton — usa-button primary action. */
import type { AdapterRenderFn } from '@formspec-org/webcomponent';

export const renderSubmitButton: AdapterRenderFn<any> = (
    behavior,
    parent,
    actx,
) => {
    const button = document.createElement('button');
    if (behavior.id) button.id = behavior.id;
    button.type = 'button';
    button.className = 'formspec-submit usa-button';
    button.textContent = behavior.defaultLabel || 'Submit';

    if (behavior.compOverrides?.cssClass) actx.applyCssClass(button, behavior.compOverrides);
    if (behavior.compOverrides?.accessibility) actx.applyAccessibility(button, behavior.compOverrides);
    if (behavior.compOverrides?.style) actx.applyStyle(button, behavior.compOverrides.style);

    parent.appendChild(button);
    const dispose = behavior.bind({ root: button });
    actx.onDispose(dispose);
};
