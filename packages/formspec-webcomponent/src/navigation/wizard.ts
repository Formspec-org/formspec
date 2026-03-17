/** @filedesc Programmatic wizard step navigation via custom event dispatch. */
import type { NavigationHost } from './index.js';

export function goToWizardStep(host: NavigationHost, index: number): boolean {
    const wizardEl = host.querySelector('.formspec-wizard');
    if (wizardEl && 'dispatchEvent' in wizardEl) {
        wizardEl.dispatchEvent(new CustomEvent('formspec-wizard-set-step', {
            detail: { index },
            bubbles: false,
        }));
        return true;
    }
    return false;
}
