# Component.json Redesign — Spec Showcase

**Date:** 2026-02-28
**Purpose:** Redesign `examples/grant-application/component.json` to serve as a spec showcase exercising all 33 built-in component types and all major Tier 3 features.
**Approach:** Spec-first. Tests follow the spec, not the other way around.

## Decisions

- **Spec-first:** Write to the spec. If the renderer can't handle it yet, the renderer catches up. The example drives implementation.
- **Tests follow:** E2E tests will be updated/rewritten to match the new component structure.
- **Definition changes:** Add `approverSignature` (attachment) to attachments group and `selfAssessment` (integer, 1-5) to projectNarrative group.

## Document-Level Structure

- `breakpoints: { sm: 576, md: 768, lg: 1024 }`
- `tokens`: Override `space.lg` (32px vs theme's 24px), add `color.accent` and `border.card`
- `components` registry with 2 custom components:
  - `ContactField(field, inputMode)` — Stack wrapping TextInput with inputMode
  - `SummaryRow(label, field)` — Columns (1fr/2fr) with bold label Text + bound Text

## Page-by-Page Design

### Page 1: Applicant Info

Features: Columns (responsive), Panel (sidebar), RadioGroup (orientation/columns), custom component usage, ConditionalGroup, responsive breakpoint overrides, markdown Text, contextual Alert.

```
Page "Applicant Info"
├── Columns [widths: "2fr 1fr", responsive: { sm: { direction: vertical } }]
│   ├── Stack (main content)
│   │   ├── Grid [columns: 2, responsive: { sm: { columns: 1 } }]
│   │   │   ├── TextInput [bind: applicantInfo.orgName]
│   │   │   └── TextInput [bind: applicantInfo.ein]
│   │   ├── RadioGroup [bind: applicantInfo.orgType, orientation: horizontal, columns: 2]
│   │   ├── ConditionalGroup [when: orgType present]
│   │   │   └── TextInput [bind: applicantInfo.orgType.orgSubType]
│   │   ├── Divider
│   │   ├── Heading [level: 3, "Contact Details"]
│   │   ├── Grid [columns: 3, responsive: { sm: 1, md: 2 }]
│   │   │   ├── ContactField [custom] x3
│   │   └── Text [when: orgType = nonprofit, markdown notice]
│   └── Panel [position: right, title: "Applicant Help", width: 280px]
│       ├── Alert [severity: info, EIN format help]
│       └── Text [format: markdown, org type guidance]
```

### Page 2: Project Narrative

Features: Tabs, Slider (all options), Badge (conditional), ProgressBar, CheckboxGroup with selectAll, Spacer with size, DatePicker with format, Rating.

```
Page "Project Narrative"
├── Stack
│   ├── TextInput [bind: projectTitle]
│   ├── TextInput [bind: abstract, maxLines: 8]
│   ├── Badge [text: "Draft", variant: warning, when: abstract empty]
│   ├── Rating [bind: selfAssessment, max: 5, icon: star]
│   ├── Tabs [tabLabels: ["Schedule", "Rates & Areas"]]
│   │   ├── Stack (Schedule)
│   │   │   ├── Grid [columns: 2]
│   │   │   │   ├── DatePicker [bind: startDate, format: MM/DD/YYYY]
│   │   │   │   ├── DatePicker [bind: endDate]
│   │   │   │   ├── NumberInput [bind: duration]
│   │   │   │   └── Spacer [size: $token.space.lg]
│   │   └── Stack (Rates & Areas)
│   │       ├── Slider [bind: indirectRate, min: 0, max: 60, step: 0.5, showValue, showTicks, when: not government]
│   │       └── CheckboxGroup [bind: focusAreas, columns: 2, selectAll: true]
│   └── ProgressBar [value: 3, max: 6, label: "Narrative completion", showPercent: true]
```

### Page 3: Budget

Features: DataTable with showRowNumbers, MoneyInput (all options), Summary mid-form, Card with elevation, Toggle with labels, Popover.

```
Page "Budget"
├── Stack
│   ├── Text [instructional]
│   ├── DataTable [bind: lineItems, allowAdd, allowRemove, showRowNumbers]
│   ├── Card [title: "Budget Summary", elevation: 1]
│   │   └── Summary [items: totalDirect, indirectCosts, grandTotal]
│   ├── Grid [columns: 2]
│   │   ├── MoneyInput [bind: requestedAmount, currency: USD, showCurrency]
│   │   └── Spacer
│   ├── Toggle [bind: usesSubcontractors, onLabel: Yes, offLabel: No]
│   └── Popover [triggerLabel: "Budget Guidelines", placement: bottom]
│       └── Text [format: markdown, guidance]
```

### Page 4: Project Phases

Features: Accordion wrapping repeats, nested DataTable, Card with title.

```
Page "Project Phases"
├── Stack
│   ├── Text [instructional]
│   ├── Accordion [allowMultiple: true, defaultOpen: 0]
│   │   └── Card [title: "Phase"]
│   │       ├── TextInput [bind: phaseName]
│   │       ├── DataTable [bind: phaseTasks, allowAdd, allowRemove]
│   │       └── Grid [columns: 2] (phase total display)
│   ├── Card [title: "Phases Summary"]
│   │   └── Grid [columns: 2] (total phases cost)
```

### Page 5: Subcontractors

Features: ConditionalGroup with fallback, Alert (dismissible), Modal (button trigger), Signature.

```
Page "Subcontractors"
├── ConditionalGroup [when: usesSubcontractors, fallback text]
│   ├── Stack
│   │   ├── Alert [severity: info, dismissible: true, 49% cap rule]
│   │   ├── DataTable [bind: subcontractors, allowAdd, allowRemove]
│   │   └── Modal [title: "Certification Requirements", trigger: button, triggerLabel: "View Requirements", size: md, closable]
│   │       └── Text [format: markdown, requirements]
```

### Page 6: Review & Submit

Features: accessibility block, Summary with optionSet, Collapsible, FileUpload (dragDrop, multiple), Signature (all options), Divider with label, cssClass.

```
Page "Review & Submit"
├── Stack [accessibility: { role: region, description: "Application review" }]
│   ├── Alert [severity: info]
│   ├── Collapsible [title: "Applicant Information", defaultOpen: true]
│   │   └── Summary [with optionSet]
│   ├── Collapsible [title: "Project Narrative", defaultOpen: true]
│   │   └── Summary
│   ├── Collapsible [title: "Budget", defaultOpen: true]
│   │   └── Summary
│   ├── Collapsible [title: "Project Phases", defaultOpen: false]
│   │   └── Summary
│   ├── Divider [label: "Supporting Documents"]
│   ├── Stack
│   │   ├── FileUpload [narrativeDoc, accept, maxSize, dragDrop: true]
│   │   ├── FileUpload [budgetJustification, accept, maxSize]
│   │   └── Signature [approverSignature, strokeColor, height, penWidth, clearable]
│   └── Alert [severity: warning, when: validation issues, cssClass: "review-alert"]
```

## Coverage Matrix

All 33 built-in components + CustomComponentRef used. All features: breakpoints, responsive, tokens (override + new), custom components, accessibility, cssClass, style, when, format: markdown, fallback.

## Definition Changes Required

1. Add `attachments.approverSignature` — type: field, dataType: attachment
2. Add `projectNarrative.selfAssessment` — type: field, dataType: integer, 1-5 range
