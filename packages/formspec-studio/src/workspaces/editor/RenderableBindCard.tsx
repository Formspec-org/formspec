import { humanizeFEL } from '@formspec-org/studio-core';
import type { FormDefinition } from '@formspec-org/types';
import { BindCard } from '../../components/ui/BindCard';
import { GuidedBindEditor } from '../../components/ui/GuidedBindEditor';

interface RenderableBindCardProps {
  bindType: string;
  value: string;
  onRemove: () => void;
  onSave: (value: string | null) => void;
  justCreatedBind?: string | null;
  onClearJustCreatedBind?: () => void;
  definition?: FormDefinition;
  placeholder?: string;
  constraintMessage?: string;
}

/**
 * Shared wrapper for BindCard + GuidedBindEditor used in ItemRowCategoryPanel.
 * Consolidates the common logic for rendering a bind rule with its inline editor.
 */
export function RenderableBindCard({
  bindType,
  value,
  onRemove,
  onSave,
  justCreatedBind,
  onClearJustCreatedBind,
  definition,
  placeholder,
  constraintMessage,
}: RenderableBindCardProps) {
  return (
    <BindCard
      bindType={bindType}
      expression={value}
      humanized={humanizeFEL(value).text}
      onRemove={onRemove}
      message={bindType === 'constraint' ? constraintMessage : undefined}
    >
      <GuidedBindEditor
        bindType={bindType}
        value={value}
        autoEdit={justCreatedBind === bindType}
        onSave={(newValue) => {
          if (justCreatedBind === bindType) {
            onClearJustCreatedBind?.();
          }
          onSave(newValue);
        }}
        definition={definition}
        placeholder={placeholder}
      />
    </BindCard>
  );
}
