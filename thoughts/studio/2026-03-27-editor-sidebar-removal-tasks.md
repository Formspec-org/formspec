# Editor Sidebar Removal Tasks

**Date:** 2026-03-27  
**Status:** Mostly Implemented  
**Scope:** `packages/formspec-studio/` Editor workspace

## Goal

Remove the Editor desktop properties rail by moving ordinary editing into the rows themselves and reserving secondary surfaces for only the densest cases.

## Tasks

### 1. Row Content Editing

- done: inline add and edit for `description`
- done: inline add and edit for `hint`
- done: group content editing in the group header flow

### 2. Row Field Config Editing

- done: inline editing for `initialValue`
- done: inline editing for `prefix`
- done: inline editing for `suffix`
- done: inline editing for `semanticType`
- done: inline editing for `precision`
- done: inline editing for `currency`
- done: inline editing for `prePopulate`

### 3. Row Behavior Editing

- done: quick editor for `required`
- done: quick editor for `relevant`
- done: quick editor for `readonly`
- done: quick editor for `calculate`
- done: quick editor for `constraint`
- done: quick editor for `constraintMessage`

### 4. Row Options Editing

- done: add option
- done: remove option
- done: edit option value
- done: edit option label

### 5. Group Editing Completion

- done: inline identity editing
- done: inline repeat editing
- done: inline content editing
- done: group behavior quick editor

### 6. Shell Simplification

- done: remove the desktop Editor properties rail from the default shell
- done: keep the center editor as the dominant working surface
- done: keep compact/mobile fallback behavior only where still necessary

### 7. Verification

- done: tree-editor tests for each new row edit path
- done: shell tests for the missing desktop Editor properties rail
- done: browser pass for row accessibility and keyboard flow
- note: row-level add-missing affordances were reduced to selected rows only to keep the default canvas and tab order usable

## Delivery Sequence

1. done: ship row content, config, behavior, and options editing
2. done: verify the editor is usable without the desktop rail
3. done: remove the desktop rail
4. done: clean up inspector assumptions that blocked row-first editing
5. next: decide whether the compact/mobile properties surface should also be reduced or kept as the dense fallback editor
