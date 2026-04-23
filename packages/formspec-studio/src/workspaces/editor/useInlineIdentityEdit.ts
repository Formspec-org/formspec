/** @filedesc Shared inline identity editing state machine for ItemRow and GroupNode. */
import { useEffect, useState, useCallback, type RefObject } from 'react';

export interface UseInlineIdentityEditOptions {
  itemKey: string;
  label: string | undefined;
  selected: boolean | undefined;
  onRenameIdentity?: (nextKey: string, nextLabel: string) => void;
  /** Ref to a button that should receive focus after commit/cancel. */
  selectButtonRef?: RefObject<HTMLButtonElement | null>;
  /** Whether this is a field (vs display/group). Affects empty-label handling. */
  isField?: boolean;
  /** Resolved label for fallback when committing. */
  resolvedLabel: string;
}

export interface InlineIdentityEditState {
  activeIdentityField: 'label' | 'key' | null;
  draftKey: string;
  draftLabel: string;
}

export interface InlineIdentityEditActions {
  setActiveIdentityField: (field: 'label' | 'key' | null) => void;
  setDraftKey: (value: string) => void;
  setDraftLabel: (value: string) => void;
  openIdentityField: (field: 'label' | 'key') => void;
  commitIdentityField: (field: 'label' | 'key') => void;
  cancelIdentityField: () => void;
  resetIdentityEditors: () => void;
  handleIdentityKeyDown: (field: 'label' | 'key') => (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function useInlineIdentityEdit({
  itemKey,
  label,
  selected,
  onRenameIdentity,
  selectButtonRef,
  isField = true,
  resolvedLabel,
}: UseInlineIdentityEditOptions): InlineIdentityEditState & InlineIdentityEditActions {
  const [activeIdentityField, setActiveIdentityField] = useState<'label' | 'key' | null>(null);
  const [draftKey, setDraftKey] = useState(itemKey);
  const [draftLabel, setDraftLabel] = useState(() =>
    label?.trim() ? label.trim() : '',
  );

  useEffect(() => {
    if (!activeIdentityField) {
      setDraftKey(itemKey);
      setDraftLabel(label?.trim() ? label.trim() : '');
    }
  }, [itemKey, label, activeIdentityField]);

  useEffect(() => {
    if (!selected) {
      setActiveIdentityField(null);
    }
  }, [selected]);

  const resetIdentityEditors = useCallback(() => {
    setActiveIdentityField(null);
  }, []);

  const openIdentityField = useCallback(
    (field: 'label' | 'key') => {
      resetIdentityEditors();
      if (field === 'key') setDraftKey(itemKey);
      if (field === 'label') setDraftLabel(label?.trim() ? label.trim() : '');
      setActiveIdentityField(field);
    },
    [itemKey, label, resetIdentityEditors],
  );

  const commitIdentityField = useCallback(
    (field: 'label' | 'key') => {
      if (!onRenameIdentity) {
        setActiveIdentityField(null);
        queueMicrotask(() => selectButtonRef?.current?.focus());
        return;
      }
      if (field === 'key' && !draftKey.trim()) {
        cancelIdentityField();
        return;
      }
      if (field === 'label' && !draftLabel.trim()) {
        if (isField) {
          cancelIdentityField();
          return;
        }
      }
      const nextKey = field === 'key' ? draftKey.trim() || itemKey : itemKey;
      const nextLabel =
        field === 'label'
          ? (isField ? (draftLabel.trim() || itemKey) : draftLabel.trim())
          : resolvedLabel;
      onRenameIdentity(nextKey, nextLabel);
      setActiveIdentityField(null);
      queueMicrotask(() => selectButtonRef?.current?.focus());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onRenameIdentity, draftKey, draftLabel, itemKey, isField, resolvedLabel, selectButtonRef],
  );

  const cancelIdentityField = useCallback(() => {
    setDraftKey(itemKey);
    setDraftLabel(label?.trim() ? label.trim() : '');
    setActiveIdentityField(null);
    queueMicrotask(() => selectButtonRef?.current?.focus());
  }, [itemKey, label, selectButtonRef]);

  const handleIdentityKeyDown = useCallback(
    (field: 'label' | 'key') => (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitIdentityField(field);
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelIdentityField();
      }
      // IE-3: Tab in identity input cycles between key and label fields.
      if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        if (isField) {
          if (field === 'key' && !event.shiftKey) {
            event.preventDefault();
            commitIdentityField('key');
            openIdentityField('label');
          } else if (field === 'label' && event.shiftKey) {
            event.preventDefault();
            commitIdentityField('label');
            openIdentityField('key');
          }
        }
      }
    },
    [commitIdentityField, cancelIdentityField, openIdentityField, isField],
  );

  return {
    activeIdentityField,
    draftKey,
    draftLabel,
    setActiveIdentityField,
    setDraftKey,
    setDraftLabel,
    openIdentityField,
    commitIdentityField,
    cancelIdentityField,
    resetIdentityEditors,
    handleIdentityKeyDown,
  };
}

