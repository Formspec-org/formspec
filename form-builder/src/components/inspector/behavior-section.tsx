import type { FormspecItem } from 'formspec-engine';
import { updateDefinition, findItemByKey } from '../../state/definition';
import { FelExpressionInput } from '../properties/fel-expression-input';
import { FelHelper } from '../properties/fel-helper';

export function BehaviorSection({ item }: { item: FormspecItem }) {
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
                <div class="section-title">Behavior</div>
                <FelHelper />
            </div>
            <div class="property-row">
                <label class="property-label">Relevant (FEL)</label>
                <FelExpressionInput
                    value={item.relevant || ''}
                    placeholder="true()"
                    onValueChange={(val) => updateField('relevant', val)}
                />
            </div>
            <div class="property-row">
                <label class="property-label">Required (FEL)</label>
                <FelExpressionInput
                    value={typeof item.required === 'string' ? item.required : ''}
                    placeholder="true() or FEL expression"
                    onValueChange={(val) => updateField('required', val)}
                />
            </div>
            <div class="property-row">
                <label class="property-label">Read Only (FEL)</label>
                <FelExpressionInput
                    value={typeof item.readonly === 'string' ? item.readonly : ''}
                    placeholder="FEL expression"
                    onValueChange={(val) => updateField('readonly', val)}
                />
            </div>
            <div class="property-row">
                <label class="property-label">Calculate (FEL)</label>
                <FelExpressionInput
                    value={item.calculate || ''}
                    placeholder="FEL expression"
                    onValueChange={(val) => updateField('calculate', val)}
                />
            </div>
        </div>
    );
}
