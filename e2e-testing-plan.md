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

### Phase 4: Exhaustive E2E Test Authoring (Red Phase) (⏳ PENDING)
Adopting a strict Red/Green Test-Driven Development (TDD) approach, we will first write the comprehensive test suite before implementing the missing features.

**1. Exhaustive Feature Tests:**
*   Create JSON Formspec fixtures covering all 55 standard FEL functions (e.g., `sum()`, `dateDiff()`, `replace()`).
*   Write Playwright specs for missing Tier 1 types: `boolean` (checkboxes), `choice` (select/radio), and `date` (datepickers).
*   Write tests asserting that `calculate: "sum(items.price)"` evaluates correctly across dynamically added repeating DOM nodes.

**2. Exhaustive Edge Case Tests:**
*   **Null Propagation:** When `calculate: "price * quantity"` evaluates but `quantity` is empty, assert the engine propagates `null` rather than throwing `NaN`.
*   **Deep Pruning:** Assert that if a parent `group` becomes hidden (`visible: false`), all nested children are strictly omitted from the final `Response` JSON, regardless of their individual visibility states.
*   **Validation Bypassing:** Assert that a field with `required: true` passes form validation if it is currently hidden (e.g., `visible: "hasSpouse == true"`).
*   **Cyclic Dependencies:** Create a fixture where `Field A` calculates from `Field B`, and `Field B` calculates from `Field A`. Assert the state engine detects the cycle and halts cleanly rather than infinitely looping and crashing the browser.
*   **Type Coercion:** Assert strict spec compliance when mathematical formulas execute against string inputs (`"10" + 5`).
*   **Empty Array Aggregation:** Assert that functions like `sum(items.price)` safely return `0` (or `null` per spec) when the user deletes all repeating instances.

**3. Verification:**
*   Run the Playwright suite to ensure all new tests **fail** against the current scaffolding (Red state).

### Phase 5: Full Engine & Component Implementation (Green Phase) (⏳ PENDING)
Implement the standard library and component mappings to satisfy the test suite.
1.  **Standard Library (FEL) Porting:** Port the 55 standard FEL functions (from `src/fel/functions.py`) into the TypeScript `compileFEL()` scope.
2.  **Full Component Mapping:** Expand the `<formspec-render>` Web Component to natively parse, mount, and bind `boolean`, `choice`, and `date` fields.
3.  **Cross-Field DOM Arrays:** Implement reactive array collection in the JS State Engine so aggregate functions over repeating groups update reactively.
4.  **Edge Case Handlers:** Introduce logic for null propagation, deep visibility pruning, validation bypassing, and cyclic dependency detection within the State Engine.
5.  **Verification:** Run the Playwright suite to ensure all tests now **pass** (Green state).

## 4. Key E2E Scenarios Automated

*   **Static Validation:** Typing invalid data (e.g., failing a `pattern` regex) immediately shows an error message and prevents valid submission.
*   **Dynamic Calculation:** Typing a `price` and `quantity` immediately updates a readonly `total` field via FEL.
*   **Conditional Visibility:** Toggling a checkbox unhides a nested section of the form; when hidden, the nested data is strictly omitted/pruned from the final `response.schema.json` as dictated by the spec.
*   **Repeating Sections:** Adding multiple instances of an item block, verifying `$index` contextual FEL variables work, and aggregating data across instances.
*   **Cross-field Validation:** Ensuring an `endDate` input cannot precede a `startDate` input, with the error state correctly attached to the `endDate` DOM element in the generated `ValidationReport`.
