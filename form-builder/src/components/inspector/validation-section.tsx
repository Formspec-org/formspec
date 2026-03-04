import type { FormspecItem } from 'formspec-engine';
import { updateDefinition, findItemByKey } from '../../state/definition';
import { FelExpressionInput } from '../properties/fel-expression-input';
import { FelHelper } from '../properties/fel-helper';

export function ValidationSection({ item }: { item: FormspecItem }) {
    function updateField(field: string, value: unknown) {
        updateDefinition((def: any) => {
            const found = findItemByKey(item.key, def.items);
            if (!found) return;
            const draft = found.item as Record<string, unknown>;
            if (value === '' || value === null || value === undefined) {
                draft[field] = undefined;
                return;
            }
            draft[field] = value;
        });
    }

    return (
        <div class="properties-content">
            <div class="section-header">
                <div class="section-title">Validation</div>
                <FelHelper />
            </div>
            <div class="property-row">
                <label class="property-label">Constraint (FEL)</label>
                <FelExpressionInput
                    value={item.constraint || ''}
                    placeholder="FEL expression"
                    onValueChange={(val) => updateField('constraint', val)}
                />
            </div>
            <div class="property-row">
                <label class="property-label">Validation Message</label>
                <input
                    class="studio-input"
                    value={item.message || ''}
                    placeholder="Error message shown on constraint failure"
                    onInput={(e) => updateField('message', (e.target as HTMLInputElement).value)}
                />
            </div>
        </div>
    );
}
