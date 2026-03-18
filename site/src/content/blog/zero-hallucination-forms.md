---
title: "Zero-hallucination form building: how typed tool calls eliminate the AI trust problem"
description: "Most AI code generation is freeform text you review line by line. Formspec's approach is different — structured MCP tool calls, JSON Schema validation, and static linting mean AI-generated forms are verified automatically."
date: 2026-03-15
tags: ["ai", "mcp", "deep-dive"]
author: "Michael Deeb & Claude"
---

A 200-field grant application with conditional sections, calculated budget fields, cross-field validation rules, and a multi-page wizard. Every change request means weeks of back-and-forth with developers. A logic error mid-cycle means re-opening submissions and contacting everyone who already filed. "Can we add a field?" becomes a project.

Formspec [collapses that gap](/blog/introducing-formspec). But collapsing it with AI introduces its own problem: if you ask a language model to generate a form definition, you get text — and text can be wrong in ways that are hard to catch until it's too late.

## The trust problem with AI-generated code

Freeform text generation is powerful and genuinely useful. But it puts the verification burden entirely on you. The model has no runtime. It has no schema to validate against. It has no linter telling it that `$org_type = 'nonprofit'` is valid FEL but `$org_type == 'nonprofit'` is not. It generates based on probability, not correctness — and the gap between those two things is exactly where bugs live.

For complex form logic — conditional visibility, calculated fields, cross-field validation rules, repeatable sections with cardinality constraints — the surface area for plausible-but-wrong output is large. An AI can generate a `relevant` expression that references a field ID that doesn't exist. It can produce a `calculate` binding that has a circular dependency. It can define a required-field rule that is always true, making the field permanently required regardless of context.

None of these failures are obvious from reading the output. They surface at runtime, sometimes only in specific conditions, sometimes only after deployment.

## Formspec's approach: typed tool calls through MCP

Formspec's MCP server takes a different approach. Instead of asking AI to generate text that represents a form definition, it gives AI a set of 28 structured tools — each with typed parameters, explicit constraints, and schema-backed validation.

When an AI agent calls `formspec_field`, it passes a structured object: `{ path, label, type }`. The `type` parameter accepts only valid Formspec data types — `string`, `number`, `decimal`, `boolean`, `date`, `email`, `choice`, `text`. If the model tries to pass `"integer_value"` or `"dropdown"` or anything outside that set, the tool schema rejects the call before it executes. The model can't hallucinate a field type. The contract doesn't allow it.

The same constraint applies to every tool. `formspec_behavior` with `action: "add_rule"` requires a `rule` parameter that is a FEL expression — and FEL expressions are validated at parse time. `formspec_flow` with `action: "set_mode"` accepts only `"single"`, `"wizard"`, or `"tabs"`. The tool layer is a typed API, not a text interface.

This shifts the model's task from "generate text that looks like valid JSON" to "call typed functions with valid parameters." That's a fundamentally different problem — and one where the verification machinery can do real work.

## Three layers of automatic verification

Typed tool calls are the first layer. But Formspec adds two more after every authoring operation.

**JSON Schema validation** runs on every write. The definition document is validated against a published JSON Schema that encodes the structural rules of the specification — required properties, allowed enum values, type constraints, pattern constraints. A definition that violates any of these cannot be saved. This catches structural errors: missing required fields, invalid property combinations, malformed expressions.

**The static linter** runs a second pass that JSON Schema can't do — semantic analysis. It checks that every field reference in a FEL expression (`$org_name`, `$budget`) resolves to an actual field in the definition. It detects unreachable conditions: branches that can never be true given the field's possible values. It flags unused variables and orphaned shape rules. It catches circular dependencies in calculated fields. These are the kinds of errors that pass schema validation but fail at runtime — and the linter surfaces them before a human ever looks at the output.

**The TypeScript type system** enforces contracts at the authoring layer. The studio-core helper methods that power the MCP tools are fully typed. A call with the wrong parameter shape is a compile-time error, not a runtime one.

Three layers, each catching a different class of problem. Together they cover the space between "syntactically valid text" and "correct definition that will behave as intended."

## FEL: why a deterministic expression language matters for AI

Formspec uses a custom expression language — [FEL](/blog/fel-design) — rather than allowing arbitrary JavaScript in form definitions. FEL is deterministic, side-effect-free, and statically analyzable. These properties make AI-generated expressions verifiable in a way that JavaScript expressions are not.

When the linter checks `$budget > 0 and $duration >= 1`, it knows exactly what fields that expression reads, what type it returns, and whether those fields exist. FEL also catches AI errors that would otherwise be silent: nonexistent stdlib functions (`$budget.toFixed(2)`), type mismatches (`$org_name + 1`), wrong paths (`$line_items.amount` instead of `$line_items[0].amount`). These fail at parse time, before the definition is saved.

## The result: you're not trusting the AI, you're trusting the validation pipeline

This is the shift that matters. With freeform AI code generation, your trust is in the model. You hope it got it right. You review to catch what it didn't.

With Formspec's approach, your trust is in a deterministic, composable verification pipeline: typed tool parameters reject invalid inputs before they execute, JSON Schema validation catches structural errors on every write, static linting catches semantic errors before runtime, and FEL's design makes expressions statically verifiable.

The model's output is a sequence of typed function calls. Each call either succeeds — meaning it passed schema, type, and semantic validation — or it fails with a specific error the model can use to correct itself. The human role shifts from line-by-line review to high-level oversight: reviewing what was built, tweaking wording, adjusting structure. The boilerplate is verified automatically. The errors that slip through freeform generation are caught before you see them.

That's not trusting AI more. It's building systems where trust is earned by the machinery, not assumed from the output.
