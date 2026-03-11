import { useState } from 'react';

interface AddItemPickerProps {
  onAdd: (type: string, dataType?: string) => void;
  onClose: () => void;
}

const ITEM_TYPES = [
  { type: 'field', label: 'Field' },
  { type: 'group', label: 'Group' },
  { type: 'display', label: 'Display' },
];

const DATA_TYPES = [
  'string',
  'integer',
  'decimal',
  'boolean',
  'date',
  'time',
  'dateTime',
  'select1',
  'select',
  'binary',
];

/**
 * Picker component for adding new items to the form definition.
 * Shows item type selection, and for fields, a secondary data type picker.
 */
export function AddItemPicker({ onAdd, onClose }: AddItemPickerProps) {
  const [showDataTypes, setShowDataTypes] = useState(false);

  const handleTypeClick = (type: string) => {
    if (type === 'field') {
      setShowDataTypes(true);
    } else {
      onAdd(type, undefined);
    }
  };

  const handleDataTypeClick = (dataType: string) => {
    onAdd('field', dataType);
  };

  return (
    <div className="bg-surface border border-border rounded shadow-lg p-3 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Add Item</h3>
        <button
          className="text-xs text-muted hover:text-ink"
          aria-label="Close"
          onClick={onClose}
        >
          x
        </button>
      </div>

      {!showDataTypes ? (
        <div className="space-y-1">
          {ITEM_TYPES.map(({ type, label }) => (
            <button
              key={type}
              className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-surface-hover transition-colors"
              onClick={() => handleTypeClick(type)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          <button
            className="text-xs text-muted hover:text-ink mb-1"
            onClick={() => setShowDataTypes(false)}
          >
            &larr; Back
          </button>
          {DATA_TYPES.map((dt) => (
            <button
              key={dt}
              className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-surface-hover transition-colors"
              onClick={() => handleDataTypeClick(dt)}
            >
              {dt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
