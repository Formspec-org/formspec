/** @filedesc Guided bind editor: wraps ConditionBuilder for boolean binds, InlineExpression for others. */
import { useState, useMemo } from 'react';
import { flatItems, parseFELToGroup, type FELEditorFieldOption } from '@formspec-org/studio-core';
import { InlineExpression } from './InlineExpression';
import { ConditionBuilder, ConditionBuilderPreview } from './ConditionBuilder';
import type { FormDefinition } from '@formspec-org/types';

const GUIDED_BIND_TYPES = new Set(['relevant', 'required', 'readonly', 'constraint']);

interface GuidedBindEditorProps {
  bindType: string;
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  autoEdit?: boolean;
  definition?: FormDefinition;
}

export function GuidedBindEditor({
  bindType,
  value,
  onSave,
  placeholder,
  autoEdit,
  definition,
}: GuidedBindEditorProps) {
  const [editing, setEditing] = useState(Boolean(autoEdit));
  const isSelfRef = bindType === 'constraint';

  const fields = useMemo<FELEditorFieldOption[]>(() => {
    if (!definition?.items) return [];
    return flatItems(definition.items).map((fi) => ({
      path: fi.path,
      label: fi.item.label || fi.path,
      dataType: fi.item.dataType,
    }));
  }, [definition]);

  if (!GUIDED_BIND_TYPES.has(bindType)) {
    return (
      <InlineExpression
        value={value}
        onSave={onSave}
        placeholder={placeholder}
        autoEdit={autoEdit}
        expressionType={bindType === 'calculate' ? 'calculate' : undefined}
      />
    );
  }

  if (editing) {
    return (
      <ConditionBuilder
        value={value}
        onSave={(fel) => {
          setEditing(false);
          onSave(fel);
        }}
        onCancel={() => setEditing(false)}
        fields={fields}
        selfReference={isSelfRef}
        autoEdit={autoEdit}
      />
    );
  }

  return (
    <ConditionBuilderPreview
      value={value}
      onClick={() => setEditing(true)}
      selfReference={isSelfRef}
    />
  );
}
