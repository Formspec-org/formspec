# Unified Component Tree Editor

## Problem

The Studio guided editor works at the Definition level (fields, groups, displays). The Component document — which controls layout, widget selection, and presentation — is a separate JSON artifact with no visual editor. Users can't add layout components (Stack, Grid, Wizard, Page, Card) or configure component-specific properties through the guided UI.

## Decision

Rewrite the guided editor as a **unified tree** that interleaves layout components and definition items. One tree, two documents. The component tree is the structural backbone; the definition is a flat set of data items referenced by `bind` keys. The user never thinks about which document they're editing.

## Architecture

```
User sees: Unified Tree
              ↓ reads from
         Component Tree (component.json `tree`)
              ↓ each bound node references
         Definition Items (definition.json `items`)
              ↓ mutations go to
         Both documents simultaneously
```

### Key Invariants

1. Every definition field/group/display has exactly one component node bound to it.
2. Layout components (Stack, Grid, Page, Wizard, Card, etc.) exist only in the component document.
3. The component tree is authoritative for ordering and nesting.
4. Definition groups still nest children (spec-compliant, works standalone).
5. A component document always exists (auto-generated from definition on import).

### Node Kinds

| Kind | In Definition? | In Component? | Example |
|------|---------------|--------------|---------|
| Layout | No | Yes | Grid, Stack, Page, Wizard, Card |
| Bound Input | Yes (field) | Yes (TextInput, Select, etc.) | TextInput bind=email |
| Bound Display | Yes (display) | Yes (Heading, Text) | Heading text from label |
| Definition Group | Yes (group) | Optional wrapper | group with children |
| Structure-only | No | Yes | Spacer, Divider, SubmitButton |

## State Model

### Signals

- `componentDoc` signal: Full component document (`$formspecComponent`, `version`, `targetDefinition`, `tree`)
- `definition` signal: Definition document (unchanged, but items may be flat or nested)
- `selectedPath` signal: Changes from definition item key to **component tree path** (e.g., `tree.children[0].children[1]`)
- Component document version signal for triggering re-renders

### Sync Strategy

- Adding an input component: creates definition field item + component node
- Deleting a bound component node: removes both component node and definition item
- Reordering in component tree: updates component tree; if crossing group boundaries, updates definition item parent
- Editing definition properties (key, label, dataType): updates definition item via existing `updateDefinition`
- Editing component properties (placeholder, columns, gap): updates component tree node

## Unified Tree Editor

### Rendering

The tree reads from `componentDoc.tree` and recursively renders nodes. Each node shows:

- **Type icon/color**: Layout=blue, Input=gold, Display=gray, Group=teal
- **Label**: Component display name or bound field's label
- **Badges**: Component type (Grid, TextInput), data type for fields (string, choice)
- **Bind indicators**: Required (*), calculated (f), constraint (check), conditional (lightning)
- **Drag handle** for reordering
- **Expand/collapse** for nodes with children

### Add Item (Categorized Picker)

Click `+` gap → categorized overlay:

**Layout**: Stack, Grid, Page, Wizard, Card, Collapsible, Columns, Tabs, Accordion
- Creates component node only. Optional title prompt for Page/Card.

**Input**: TextInput, NumberInput, DatePicker, Select, RadioGroup, CheckboxGroup, Toggle, FileUpload, MoneyInput, Slider, Rating, Signature
- Prompts for label (generates key). Creates definition field + component node.
- Default dataType by component: TextInput→string, NumberInput→number, DatePicker→date, Select→choice, Toggle→boolean, FileUpload→attachment, etc.

**Display**: Heading, Text, Divider, Alert, Badge, ProgressBar, Summary, ValidationSummary, SubmitButton
- Heading/Text: creates definition display item + component node
- Divider/SubmitButton/Alert/Badge/ProgressBar: component-only (no data)

**Structure**: Group, ConditionalGroup, Spacer, DataTable
- Group: definition group + component wrapper
- ConditionalGroup: component-only (with `when`)
- Spacer: component-only
- DataTable: component node bound to repeatable group

## Properties Panel

### Schema-Driven Component Properties

Derive property editors from `schemas/component.schema.json`:

1. Read `$defs/{ComponentType}` properties
2. Generate editors by JSON Schema type:
   - `string` → text input
   - `string` with `enum` → select dropdown
   - `integer`/`number` → number input
   - `boolean` → toggle
   - `array` → tag editor or JSON editor
   - `object` → JSON editor
3. Shared base props: `when`, `style`, `responsive`, `cssClass`, `accessibility`

### Panel Content By Node Kind

**Layout node** (Stack, Grid, etc.): Component properties only
- Component-specific props derived from schema
- Shared base props (when, style, responsive, cssClass, accessibility)

**Bound input node** (TextInput → field): Merged definition + component properties
- Identity: key, label, component type
- Data: dataType, options, placeholder, inputMode, prefix/suffix
- Behavior: required, relevant, readonly, calculate, constraint, message
- Presentation: when, style, responsive, cssClass
- Accessibility overrides

**Group node**: Definition group + optional wrapper properties
- Identity: key, label
- Repeat: repeatable, minRepeat, maxRepeat
- Behavior: relevant, readonly

**Display node**: Merged if bound, component-only if not

## Import / Export

### Definition-Only Import

When importing a definition without a component document:
1. Auto-generate component tree by wrapping all items in a Stack
2. Map each field to default component: string→TextInput, choice→Select, boolean→Toggle, etc.
3. Groups become nested Stacks

### Export

- **Definition only**: Extract definition items from unified state
- **Full bundle**: Export both definition.json + component.json
- **Component only**: Export component document

### Definition Extraction

Walk component tree → for each bound node, emit definition item. Groups collect children. Layout-only nodes skipped.

## Scope

One big rewrite pass. Files affected:
- `form-builder/src/components/tree/tree-editor.tsx` — rewrite to read from component tree
- `form-builder/src/components/tree/tree-node.tsx` — new rendering for component node types
- `form-builder/src/components/properties/` — schema-driven component properties, merged panels
- `form-builder/src/state/definition.ts` — sync between component tree and definition
- `form-builder/src/state/project.ts` — component document state
- `form-builder/src/types.ts` — new types for unified tree nodes
- `form-builder/src/logic/` — component schema registry, sync logic
- `form-builder/styles.css` — new styles for categorized picker, component node rendering
- All tests — rewrite for new architecture
