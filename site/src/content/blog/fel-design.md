---
title: "Designing FEL: Why Formspec has its own expression language"
description: "We evaluated CEL, JSONLogic, JSONata, Power Fx, and JEXL before building FEL. Here's every alternative side by side — same expressions, six languages — and the Rust-based future that makes owning a language sustainable."
date: 2026-02-25
tags: ["specification", "fel", "deep-dive"]
author: "Michael Deeb & Claude"
---

Formspec ships its own expression language. That sounds like NIH syndrome. Look at the same expressions written in every alternative we evaluated, then decide.

## The basics: where every language looks similar

Simple comparisons, arithmetic, and conditionals work in every language we evaluated. The differences are cosmetic:

```
Task: Show a field when org_type is "nonprofit"
FEL:        $org_type = 'nonprofit'
CEL:        org_type == "nonprofit"
JSONLogic:  {"==": [{"var": "org_type"}, "nonprofit"]}

Task: Calculate monthly budget from award amount and duration
FEL:        $award_amount / $duration_months
CEL:        award_amount / duration_months
JSONLogic:  {"/": [{"var": "award_amount"}, {"var": "duration_months"}]}

Task: Conditional — use EIN for nonprofits, DUNS otherwise
FEL:        if($org_type = 'nonprofit', $ein, $duns)
CEL:        org_type == "nonprofit" ? ein : duns
Power Fx:   If(OrgType = "nonprofit", EIN, DUNS)
```

FEL and Power Fx use `=` and `if()` — spreadsheet conventions. CEL, JEXL, and JSONata use `==` and `? :` — programmer conventions. JSONLogic wraps everything in JSON. These are style differences, not capability differences.

## Where the languages diverge

Two tasks separate real form expression languages from general-purpose ones: **aggregation over repeating sections** and **date arithmetic**.

```
Task: Sum amounts from all line items in a budget table
FEL:        sum(items[*].amount)
CEL:        items.map(item, item.amount).reduce(0, (acc, val) -> acc + val)
Power Fx:   Sum(Items, Amount)
JSONata:    $sum(items.amount)
JEXL:       ❌ No aggregation over collections
JSONLogic:  {"reduce": [{"map": [{"var": "items"}, {"var": "amount"}]},
              {"+": [{"var": "current"}, {"var": "accumulator"}]}, 0]}

Task: End date must be at least 30 days after start date
FEL:        datediff($end_date, $start_date, 'days') >= 30
CEL:        end_date - start_date >= duration("720h")
Power Fx:   DateDiff(StartDate, EndDate, TimeUnit.Days) >= 30
JSONata:    ($toMillis(end_date) - $toMillis(start_date)) / 86400000 >= 30
JEXL:       ❌ No date arithmetic
JSONLogic:  ❌ No date arithmetic
```

FEL's `[*]` wildcard reads like a spreadsheet formula: "for every item, grab the amount, sum them." CEL requires map/reduce thinking. JEXL and JSONLogic lack date support entirely. JSONata requires manual millisecond math. Power Fx handles both cleanly — but runs only in C#.

## Form-domain expressions: where general-purpose languages break down

Three capabilities separate a form expression language from a general-purpose one.

```
Task: Calculate subtotal inside a repeating line item
FEL:        $quantity * $unit_price       (auto-scoped to current row)
Power Fx:   ThisRecord.Quantity * ThisRecord.UnitPrice
CEL:        ❌ No repeat-instance scoping — manage index yourself
JEXL:       ❌ No scoping model
JSONLogic:  ❌ No scoping model

Task: Show a warning only when the email field has a validation error
FEL:        not(valid($email))
All others: ❌ No concept of field metadata queries

Task: Look up last year's revenue from a secondary data source
FEL:        @instance('priorYear').revenue
All others: ❌ Require variable injection — intent less visible
```

FEL scopes `$field` references to the current repeat instance automatically. Inside the third line item, `$quantity` means "the quantity in row 3." It also provides `@current`, `@index`, and `@count` as context references inside repeats.

FEL's MIP query functions — `valid()`, `relevant()`, `readonly()`, `required()` — inspect the state of other fields at runtime. No general-purpose expression language offers this; it is a form-domain concept.

`@instance()` references secondary data sources — lookup tables, prior-period data, reference lists — with syntax that distinguishes external data from form fields.

## The full comparison

| Requirement | FEL | CEL | Power Fx | JSONata | JEXL | JSONLogic |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| JS + Python runtimes | Yes | Yes | **No** (C# only) | Yes | Yes | Yes |
| Spreadsheet-like syntax | Yes | No (`&&` `==` `? :`) | **Yes** | No | No | No (JSON) |
| Date arithmetic | Yes | Partial | Yes | Manual | No | No |
| Collection aggregation | `[*]` wildcard | map/reduce | `Sum(T, F)` | Implicit | No | Verbose |
| Repeat-instance scoping | Yes | No | Yes | Implicit | No | No |
| Field metadata queries | Yes | No | No | No | No | No |
| Guaranteed termination | Yes | Yes | Yes | **No** | Yes | Yes |
| Non-programmer friendly | Yes | No | **Yes** | No | No | No |

Two languages satisfy every requirement: **FEL** and **Power Fx**. Power Fx is the closest match — Microsoft built "Excel formulas as a programming language." But Power Fx is C#-only, deeply coupled to the Microsoft Power Platform. Architecturally perfect, practically inaccessible.

The ecosystem splits into two non-overlapping groups. **Spreadsheet-syntax languages** (Power Fx, HyperFormula) are locked to C# or a grid model. **Cross-platform languages** (CEL, JSONata, JEXL) use programmer syntax. No existing language combines spreadsheet-familiar syntax, cross-platform runtimes, and form-domain semantics. FEL exists because the intersection is empty.

## FEL's lineage

FEL is a deliberate synthesis of three predecessors.

**Power Fx gave us the function vocabulary.** `if()`, `sum()`, `concat()`, `datediff()` — Excel formula conventions that Power Fx formalized into a language. FEL's stdlib reads like Power Fx because both descend from the same source: the Excel formula bar. We adopted the philosophy wholesale: functions look like spreadsheet formulas, not method chains.

**JSONata gave us the data model.** The `$` prefix, path-based JSON navigation, and functional aggregation are JSONata concepts. JSONata's path expressions shaped how FEL navigates form field hierarchies. The key difference: JSONata iterates implicitly — write `items.amount` and it maps over arrays automatically. FEL requires explicit `[*]` wildcards. Form authors should see when an expression iterates; implicit iteration surprises.

**XForms gave us the bind model.** Five declarative expressions — `calculate`, `relevant`, `required`, `readonly`, `constraint` — attached to data nodes and evaluated over a reactive dependency graph. Twenty years old, still the most complete model for form logic. FEL runs inside this model; MIP query functions exist to support it.

The synthesis: **Power Fx's function style + JSONata's JSON path semantics + XForms' reactive bind model**, constrained to be non-Turing-complete and extended with form-domain features (repeat scoping, metadata queries, money arithmetic).

If FEL looks familiar, good. We designed it so Excel users and JSONata users both feel at home.

## Why not just use one of them?

Zero users, zero backwards compatibility — if adopting an existing language worked, we would have.

**Could we use CEL?** Technically, yes. CEL satisfies every requirement except syntax familiarity. The entire delta: `==` vs `=`, `&&` vs `and`, `? :` vs `if()`, bare identifiers vs `$field` references. We would register ~14 custom functions and be done. AI studio users would not notice. Power users editing expressions directly would: `sum(items[*].amount)` versus `items.map(item, item.amount).reduce(0, (acc, val) -> acc + val)`.

**Could we use JSONata?** The `$` collision kills it. JSONata uses `$` for both variables and built-in functions (`$sum`, `$map`). FEL uses `$` only for field references. The conventions conflict. Beyond that, JSONata is Turing-complete — lambdas, recursion, no termination guarantee. Restricting it means forking it, and a "JSONata-minus-the-dangerous-parts" fork is worse than maintaining FEL.

**Could we use Power Fx?** The syntax is ideal. The runtime exists only in C#. Microsoft has acknowledged requests for a JavaScript implementation and provided no timeline. We cannot wait for a maybe.

**Could we jerry-rig it — FEL syntax compiling to a CEL or JSONata backend?** The parser is the easy part (~256 lines of lexer). The evaluator is the hard part (null propagation, array broadcasting, scope resolution, special forms). A transpiler has the same complexity as an evaluator, plus you inherit the target's semantic quirks. Three layers instead of one.

## What it cost — and why that cost is temporary

The price of owning FEL today:

- ~2,300 lines of TypeScript (Chevrotain lexer, parser, interpreter, dependency visitor)
- ~3,000 lines of Python (hand-written recursive descent parser, AST, evaluator, stdlib)
- ~400 lines of formal grammar specification
- ~2,500 lines of conformance tests
- Two implementations to maintain, debug, and keep in sync

Three-quarters of FEL's ~50 stdlib functions are generic — arithmetic, strings, dates, type checking — what CEL or JSONata already provides. The remaining quarter is domain-specific: MIP queries, repeat navigation, money operations. The domain-specific functions justify owning the language. The generic ones are the tax.

CEL plus custom functions: ~1,500 lines. FEL: ~5,300 lines across two languages. That is the upfront cost. The ongoing cost matters more: every bug fixed twice, every function implemented twice, every edge case tested in two languages.

The Rust rewrite eliminates that ongoing cost.

## The Rust rewrite: one implementation, every platform

Two hand-written parsers and evaluators are the biggest cost of owning a custom language. Sustainable for proving a specification; not sustainable as infrastructure.

The plan: rewrite FEL in Rust and compile to every platform from one codebase.

- **WebAssembly** for the browser (replacing the Chevrotain-based TypeScript implementation)
- **Python extension** via PyO3 (replacing the hand-written recursive descent parser)
- **Native library** via C FFI for mobile apps (iOS, Android), desktop applications, and server runtimes with C interop

One parser. One evaluator. One set of stdlib functions. One place to fix bugs.

### Why Rust, and why pest

FEL has a [normative PEG grammar](/docs/specs/fel-grammar) defining exactly what the parser accepts. [pest](https://pest.rs/) is a Rust PEG parser generator. The translation from spec grammar to `.pest` file is nearly mechanical:

```
# FEL spec (normative PEG)
Equality ← Comparison ((_ '!=' / _ '=') _ Comparison)*
FieldRef ← '$' Identifier PathTail* / '$' / ContextRef

// pest equivalent
Equality = { Comparison ~ (("!=" | "=") ~ Comparison)* }
FieldRef = { "$" ~ Identifier ~ PathTail* | "$" | ContextRef }
```

The grammar has ~90 productions. pest compiles them to a typed parse tree at build time. The `.pest` file *is* the specification — no drift between spec and parser. It targets no-std Rust, so WASM works out of the box. The `Pairs` API supports both evaluation and dependency extraction from the same parse tree.

The estimated implementation:

| Component | Lines | Notes |
|---|---|---|
| pest grammar + parser | ~400 | FEL's PEG translates near 1:1 |
| AST types | ~200 | Rust enums for each node type |
| Evaluator | ~800 | Null propagation, broadcasting, scope resolution |
| Stdlib (~50 functions) | ~600 | chrono for dates, rust_decimal for money |
| Dependency extractor | ~200 | AST walker for reactive wiring |
| WASM bindings | ~150 | wasm-bindgen, serde for JSON |
| PyO3 bindings | ~150 | maturin for Python packaging |
| **Total** | **~2,500** | Single codebase, every platform |

~2,500 lines of Rust replaces ~5,300 lines across TypeScript and Python. The conformance suite validates one implementation against the spec, not two against each other.

This changes the cost comparison with CEL. Today FEL costs 3-5x more. After the rewrite, FEL is one codebase compiled to every platform — the same architecture as adopting an existing language, with syntax and semantics we control.

### What Rust unlocks

A Rust core opens platforms that TypeScript and Python cannot reach:

- A Swift iOS app embeds the C FFI library and evaluates FEL natively
- A Kotlin Android app does the same
- A Go backend calls the shared library without spawning a Python process
- A C++ desktop application links against it directly

"Same expression, same result, every environment" becomes a property of the compiled artifact, not of two synchronized codebases.

## The honest tradeoff

FEL is a deliberate bet: form-author ergonomics and language control justify custom infrastructure over ecosystem leverage. The closest alternative was CEL — mature ecosystem, programmer syntax. The second was Power Fx — ideal syntax, C#-only. The third influence was JSONata — right data model, Turing-complete and `$`-conflicted.

The TypeScript and Python implementations proved the specification precise enough to implement independently — both pass the same conformance suite. Because FEL expressions are strings in JSON, a linter catches undefined references, type mismatches, and circular dependencies at authoring time. CEL offers similar static analysis; this capability is not unique to FEL.

The biggest risk of a custom language is maintaining multiple implementations. The Rust rewrite eliminates it. One codebase, every platform — the same cost profile as adopting an existing language, with the syntax and semantics we need.

The specification is the canonical reference: `specs/fel/fel-grammar.md`.
