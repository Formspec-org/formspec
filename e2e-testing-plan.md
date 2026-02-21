# Formspec End-to-End Testing Plan

This document outlines the strategy for end-to-end (E2E) testing the Formspec standard.

## 1. Philosophy: Prove Implementability

As a declarative standard, testing Formspec's validity requires proving it can successfully drive a real-world user interface. A purely headless Python state machine validates the math but not the developer experience or the completeness of the presentation layer.

Our E2E testing strategy is to build a **Reference Implementation** using Web Components and test it using a real browser automation framework.

This achieves three goals:
1.  **Validates Tier 1 (Core):** Proves the data model, validation rules, and FEL expressions work in practice.
2.  **Validates Tiers 2 & 3 (Theme/Components):** Proves the presentation hints and component models cleanly map to actual DOM structures and CSS.
3.  **Provides a Reference:** Gives adopters a working codebase showing exactly how to implement the standard, accelerating adoption.

## 2. Architecture

The E2E suite will consist of three layers:

### Layer A: Core State Engine (TypeScript)
A framework-agnostic library that manages form state.
*   **Input:** A Formspec JSON definition.
*   **State Tree:** Maintains the current data values and metadata (touched, dirty, valid).
*   **Reactivity:** Re-evaluates FEL expressions (`calculate`, `visible`, `valid`) when dependencies change.
*   **Output:** Generates standard `Response` and `ValidationReport` JSON documents.

*Architectural Note: Porting the Python FEL evaluator to TypeScript represents a dual-maintenance burden. However, since the majority of Formspec adopters will build web UIs, a JavaScript/TypeScript reference implementation of FEL and the State Engine is arguably a necessity for the standard's success. We will use a lightweight reactivity primitive (`@preact/signals-core`) rather than reinventing reactive state management from scratch.*

### Layer B: Web Component Renderer (HTML/JS)
A custom element (`<formspec-render>`) that binds the State Engine to the DOM.
*   Parses the Formspec definition and dynamically generates native HTML input widgets.
*   Maps Tier 2 (Theme) properties to CSS custom properties (variables) or utility classes.
*   Maps Tier 3 (Components) to specific DOM structures (e.g., date pickers, select dropdowns).
*   Listens to DOM `input` events, updates the State Engine, and reactively updates the DOM (e.g., hiding/showing fields based on FEL).

### Layer C: Browser Automation (Playwright)
The actual E2E tests driving the browser.
*   Loads a test harness HTML page with specific Formspec JSON fixtures.
*   Simulates user interactions (typing, clicking, submitting).
*   Asserts DOM state (e.g., "Is the 'spouse name' field visible in the DOM?").
*   Asserts standard compliance (e.g., "Did the form generate a valid `response.schema.json` upon submission?").

## 3. Implementation Phases & Current Status

### Phase 1: Core JavaScript State Engine & FEL Scaffold (✅ COMPLETE)
1.  Built the reactive state manager that tracks values, paths, and validation errors using `@preact/signals-core`.
2.  Implemented a lightweight JIT compiler for FEL that converts basic math and logical expressions into JS Closures.

### Phase 2: The `<formspec-render>` Web Component (✅ COMPLETE)
1.  Created the zero-dependency custom element.
2.  Implemented basic field rendering (text, number, group).
3.  Wired up two-way data binding between the DOM inputs and the State Engine.
4.  Implemented dynamic visibility, calculated values, and repeating DOM instances.

### Phase 3: Playwright Test Harness (✅ COMPLETE)
1.  Set up Playwright with a Vite Dev Server.
2.  Created a directory of JSON Formspec fixtures representing complex scenarios.
3.  Wrote test suite covering repeating groups, visibility, dynamic calculations, pattern matching, and spec schema compliance.

### Phase 4: Full Standard Coverage & FEL Parity (⏳ PENDING)
To bring the JS Reference Implementation to complete parity with the Formspec Standard and Python Core, we must expand test coverage across the entire specification:

1.  **Standard Library (FEL) Porting:** Port all 55 standard FEL functions (from `src/fel/functions.py`) into the TypeScript `compileFEL()` scope. This includes:
    *   *Aggregates:* `sum()`, `count()`, `avg()`, `min()`, `max()`
    *   *Strings:* `length()`, `contains()`, `replace()`, `trim()`, `matches()`
    *   *Math:* `round()`, `abs()`, `power()`
    *   *Dates:* `dateDiff()`, `dateAdd()`, `year()`, `month()`
2.  **Full Component Mapping:** Expand the `<formspec-render>` Web Component to natively parse and mount all Tier 1 Types:
    *   `boolean` (Checkboxes)
    *   `choice` / `options` (Select dropdowns & radio groups)
    *   `date` & `time` (Native datepickers)
3.  **Cross-Field DOM Arrays:** Ensure expressions like `calculate: "sum(items.price)"` natively map over repeating `[0], [1], [n]` nested groups and update reactively.

## 4. Key E2E Scenarios Automated

*   **Static Validation:** Typing invalid data (e.g., failing a `pattern` regex) immediately shows an error message and prevents valid submission.
*   **Dynamic Calculation:** Typing a `price` and `quantity` immediately updates a readonly `total` field via FEL.
*   **Conditional Visibility:** Toggling a checkbox unhides a nested section of the form; when hidden, the nested data is strictly omitted/pruned from the final `response.schema.json` as dictated by the spec.
*   **Repeating Sections:** Adding multiple instances of an item block, verifying `$index` contextual FEL variables work, and aggregating data across instances.
*   **Cross-field Validation:** Ensuring an `endDate` input cannot precede a `startDate` input, with the error state correctly attached to the `endDate` DOM element in the generated `ValidationReport`.
