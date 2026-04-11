# ADR 0011: Hardening & Convergence Plan

## Status
Implemented (updated 2026-02-24)
**Lifecycle**: Historical hardening plan (executed)
**Objective**: Transition the Formspec Reference Implementation from a "Regex-driven Spike" to a "Specification-compliant Architecture."

### Completion Update (2026-02-24)
- Pillar 3.1 (FEL AST Interpreter): Complete.
- Pillar 3.2 (Path Resolver replacement): PathResolver stub removed; runtime uses unified engine path handling.
- Pillar 3.3 (Component Registry): Complete.
- Pillar 3.4 (Reactive reconciliation): Host-level destructive `innerHTML` wipe removed; render root is preserved and updates are reconciled incrementally (`c452d94`).

---

## 1. Executive Summary
The initial implementation (Milestones 1–4) successfully demonstrated the feasibility of the Formspec standard. However, to meet the "No Tech Debt" mandate for a greenfield project, we must pivot. The current architecture relies on high-interest debt: string-based pathing, imperative DOM manipulation, and a security-sensitive logic evaluator (`new Function()`). 

This plan outlines the structural refactoring required to harden the foundation before proceeding to Tier 2 (Theming) and advanced Mapping features.

## 2. Problem Statement: The Prototype's Debt
The current codebase contains four primary architectural bottlenecks:
1.  **Security Risk**: Using `new Function()` for FEL evaluation is a liability.
2.  **Structural Fragility**: A 500-line `switch` statement for rendering prevents extensibility.
3.  **Data Inaccuracy**: Dotted-string pathing cannot handle the hierarchical requirements of the specification (repeatable nested groups).
4.  **UX Degradation**: Destructive UI updates (`innerHTML = ''`) break user focus and performance.

## 3. Architectural Pillars
To achieve a "Zero Debt" state, the implementation will be rebuilt on four spec-aligned pillars.

### 3.1 Formal Logic: The FEL AST Interpreter
We will eliminate `eval()` and `new Function()`.
*   **Implementation**: Create a dedicated Lexer/Parser for the Formspec Expression Language (FEL).
*   **Mechanism**: Expressions will be parsed into an Abstract Syntax Tree (AST).
*   **Outcome**: 
    *   **Security**: Expressions are interpreted in a safe sandbox.
    *   **Static Analysis**: The engine can determine dependencies (signals) by traversing the AST *before* execution.
    *   **Validation**: Full compliance with FEL §3 and §4 (type checking).

### 3.2 Data Navigation: The JSON Pointer Resolver
We will replace manual string splitting with a robust path resolution engine.
*   **Implementation**: Adopt **JSON Pointer (RFC 6901)** as the primary internal indexing language.
*   **Mechanism**: All signals and data nodes will be indexed by their absolute path in the Formspec Instance.
*   **Outcome**: Support for relative paths (`../`), index-aware expressions (`$index`), and cross-collection lookups.

### 3.3 Modular UI: The Component Registry
We will move from a monolithic "God Object" renderer to an extensible registry.
*   **Implementation**: Define a `ComponentRegistry` where UI widgets register themselves.
*   **Mechanism**: The `<formspec-render>` element becomes a "Shell." It iterates through the Tier 3 Component Document and delegates rendering to registered handlers based on the `component` key.
*   **Outcome**: The system becomes "Open-Closed"—new components can be added without modifying the core renderer.

### 3.4 UX Stability: Reactive Reconciliation
We will stop wiping the DOM.
*   **Implementation**: Integrate a lightweight declarative templating engine (e.g., **Lit-html** or **Preact**).
*   **Mechanism**: Component renderers will return declarative templates. The system will "diff" the UI, updating only the specific nodes that changed.
*   **Outcome**: 
    *   **Focus Retention**: User input focus is preserved during calculations.
    *   **Performance**: Sub-millisecond UI updates even for large forms.

---

## 4. Implementation Phases

### Phase 1: Logic & Data Hardening (Structural Foundation)
*   **Task 1.1**: Build/Integrate FEL Lexer & Parser.
*   **Task 1.2**: Implement AST Interpreter in `formspec-engine`.
*   **Task 1.3**: Implement `PathResolver` (JSON Pointer).
*   **Task 1.4**: Refactor `FormEngine` to use AST-based dependency tracking.

### Phase 2: Architectural Decoupling (Renderer Refactor)
*   **Task 2.1**: Implement `ComponentRegistry` in `formspec-webcomponent`.
*   **Task 2.2**: Modularize "Core" components (TextInput, Stack, Grid, etc.) into separate files.
*   **Task 2.3**: Implement the Component Interface (`props`, `signals`, `slots`).

### Phase 3: UX & Performance (Reconciliation)
*   **Task 3.1**: Integrate Lit-html for fine-grained DOM diffing.
*   **Task 3.2**: Map Signals to Template Holes.
*   **Task 3.3**: Implement efficient "Repeatable Section" reconciliation (keyed list rendering).

---

## 5. Success Metrics
*   **Security**: Zero instances of `eval` or `new Function` in the repository.
*   **Correctness**: 100% pass rate on the FEL Normative Test Suite (including relative paths).
*   **Extensibility**: Adding a custom component requires < 5 lines of code in the main package.
*   **Performance**: A form with 100 fields updates in under 16ms (60fps).

## 6. Roadmap & Milestones

| Milestone | Deliverable | Target Date |
| :--- | :--- | :--- |
| **M1: Hardened Engine** | AST Parser + JSON Pointer Resolver | Week 1 |
| **M2: Decoupled Renderer** | Component Registry + Modular Core | Week 2 |
| **M3: Reactive UI** | Lit-html Integration + Fine-grained Updates | Week 3 |
| **M4: Spec Parity** | Validation Shapes + Responsive Overrides | Week 4 |

---

**Approval**:
*Shelley, Lead Architect*
