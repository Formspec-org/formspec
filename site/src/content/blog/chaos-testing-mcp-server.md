---
title: "Chaos testing an MCP server with AI personas"
description: "We built a Claude Code skill that spawns five AI personas — from a nervous admin assistant to an API-first developer — to stress-test our form-building MCP server. Here's the pipeline and what we found."
date: 2026-03-17
tags: ["ai", "mcp", "testing", "deep-dive"]
author: "Michael Deeb & Claude"
---

Formspec's [MCP server](/blog/zero-hallucination-forms) validates every tool call against typed schemas, runs a static linter after every write, and rejects malformed FEL expressions at parse time. That pipeline catches a lot. But it catches *correctness* — structural violations, type mismatches, invalid expressions. It doesn't catch the moment where a user provides exactly the right parameter and the system silently ignores it.

We didn't have users yet. So we built them.

## The approach

We built a four-phase pipeline — a reusable Claude Code skill you invoke with `/chaos-test` — with a human checkpoint between each phase:

1. **Blind user testing** — 5 AI personas build real forms using only the MCP tools
2. **Root cause analysis** — trace every issue through the architecture stack
3. **Independent review** — a skeptical reviewer challenges the proposed fixes
4. **Parallel implementation** — ship the approved fixes, grouped by layer

The checkpoints are what make this a methodology rather than a script. You review findings before tracing causes, review causes before approving fixes, review fixes before shipping code. AI does the labor; humans make the judgment calls.

### Personas that find different bugs

The skill generates five personas by randomizing across experience level, professional role, personality traits, and working style. Coverage rules ensure spread — at least one beginner, one intermediate, one expert, no shared working styles.

From our first run:

| Persona | Background | Model |
|---------|-----------|-------|
| **Priya** | Admin assistant, never used a form builder, cautious and methodical | haiku |
| **Marcus** | Teacher, used Google Forms, impatient and creative | sonnet |
| **Dana** | Event coordinator, used Typeform, meticulous and exploratory | sonnet |
| **Raj** | Business analyst, built forms programmatically, perfectionist | sonnet |
| **Zoe** | Researcher, API-first developer, chaotic, tries random things | opus |

Beginners get `haiku` (smaller, less capable) on the theory that a weaker model is more likely to misread error messages or take wrong turns — closer to a confused human. Experts get `sonnet` or `opus` (larger, more capable), which can attempt complex multi-step workflows that surface edge cases a beginner would never reach. Whether model capability truly maps to user sophistication is an open question. In practice, it produced useful variance.

Each persona gets one instruction: build a form you'd actually need in your role. No source code, no docs, no filesystem — only MCP tools. Try things, read errors, adapt. Stay in character.

## Three failure modes

All five personas successfully built their forms. But they also surfaced 9 bugs, 8 UX issues, and 4 confusion points. The interesting thing isn't the count — it's that the bugs fell into distinct categories that no single testing approach would cover.

### When the system confirms something that didn't happen

Zoe built a research survey with employment-status branching. She wanted to show a section when employment was *either* full-time or part-time, so she defined two branch arms targeting the same section. The tool reported success for both calls. But only the second condition was stored — the first was silently overwritten.

This is the most dangerous class of bug: the system tells you it worked. You move on. The form ships. Respondents who select the first option see nothing. You find out from a user complaint, not from any diagnostic. The audit passed. The preview looked fine with the second option selected. Nothing in the tooling signaled a problem.

Zoe found this because her working style was to try complex conditional logic — two branch arms sharing a target is an unusual but valid pattern. A methodical persona building a simpler form would never construct this scenario.

### When validation silently passes

Raj built an expense report with repeating line items and added a rule: amounts must be positive. The rule was stored — the shape count incremented, the audit showed zero errors. But when he submitted a response with a negative amount, validation passed.

The root cause was deep in the engine's FEL interpreter. When evaluating `$line_items.amount` inside a repeat context, the path resolver produced candidates like `line_items[0].line_items.amount` instead of `line_items[0].amount`. The expression matched nothing, returned an empty array, and the constraint check treated the array as truthy. One path-resolution bug silently broke *all* FEL expressions referencing fields inside repeat groups — shapes, constraints, required, readonly, calculated values.

Raj found this because he was the only persona who built a form complex enough to use both repeating groups and cross-field validation rules. Priya's office supply request had a repeating group too, but she never added a shape rule — her haiku model didn't think to.

### When the error message gaslights you

Dana called `formspec_content` with `props: { parentPath: "registration" }` in wizard mode. The error: "Cannot add a 'display' at root — provide a parentPath." She had provided it. She tried variations — different quoting, different group names, the full path. Same error every time. She eventually discovered that the batch `items[]` form of the same tool worked with the exact same props.

The cause: the single-item code path had an inline Zod schema that only declared `page` as a valid prop. `parentPath` was stripped as an unknown key before the handler ever saw it. The batch path referenced a shared schema that correctly included both `page` and `parentPath`. Same tool, two code paths, one silently dropping a parameter.

Two personas hit this independently — Dana through systematic exploration, Zoe through chaotic experimentation. Independent rediscovery is a strong signal. A bug that one persona hits might be an edge case. A bug that two personas find through different paths is a design flaw.

## Where the bugs lived

Phase 2 traces each issue through the architecture stack to find where the fix belongs — not where the symptom appears, but where the root cause lives.

| Layer | Root Causes |
|-------|------------|
| Spec / Schema / Types | 0 |
| Engine | 2 (highest severity) |
| Core | 2 |
| Studio-core | 7 |
| MCP | 6 |

Studio-core was the hottest layer — seven issues rooted there. The engine only had two, but they were the highest severity: both produced silently wrong results rather than errors.

## The skeptic

Phase 3 is the most valuable part of the pipeline. An independent reviewer agent — given only the findings and proposed fixes, no codebase access — challenges every recommendation. Three of its pushbacks changed what we shipped.

**"The fix is too shallow."** The analysis team proposed fixing the repeat-group path resolution (Raj's silent validation bug) with regex-based rebasing: detect when a FEL reference starts with a repeat group name and substitute the current instance index. The reviewer rejected it. Regex rebasing would handle `line_items[0].amount` but fail on nested repeats like `sections[0].line_items[1].amount` — the regex has no concept of scope. It's pattern-matching paths, not understanding them. The engine needs a proper scope model where each repeat context knows its parent context and resolves references relative to its nesting position. Another string-manipulation heuristic would just be the next thing to break. Since a workaround existed (`$field` sibling references), the reviewer recommended deferring until the scope model was designed. That pushback saved us from shipping a fix that would create a harder bug six months later.

**"There's a simpler alternative."** The analysis team proposed making `formspec_create` conditionally smart — detecting blank projects and auto-transitioning past the bootstrap phase that confused beginners. The reviewer said: don't add conditional behavior. Just make `formspec_load` cheap and implicit. Reducing friction is simpler than adding intelligence. Same outcome, less code, fewer edge cases.

**"This is whack-a-mole."** The analysis team proposed merging two handler dispatches into one for a specific undo-granularity bug. The reviewer pointed out that every future multi-step helper would have the same problem. The real fix was a transaction mechanism in core dispatch — one user action, one undo snapshot, regardless of how many handlers it touches. Fixing the symptom for one case would just defer the pattern.

The reviewer's top 3 priorities for immediate shipping were different from the analysis team's. That tension is the point. The analysis team thinks about root causes. The reviewer thinks about risk, blast radius, and what you can ship confidently this week.

After the human checkpoint approved a final fix list, Phase 4 grouped fixes by stack layer and shipped them in parallel — 21 issues across 22 files, 55 new tests, zero regressions across ~1,500 existing tests.

## Adapting the pattern

The technique works for any tool-call API that humans interact with through AI — MCP servers, function-calling endpoints, CLI tools wrapped in agents. The core ingredients:

1. **Personas with real variation** — different roles, personalities, and working styles, not just experience tiers. A cautious admin assistant and a chaotic researcher find fundamentally different bugs.
2. **Blind testing** — no documentation, no source code, no hints. Tool descriptions and error messages are the only interface. If your tool can't be figured out from its schema and errors alone, that's a finding.
3. **Independent review** — someone who hasn't seen the code challenges every proposed fix. The reviewer's job is to find the fix that creates the next bug.
4. **Human checkpoints** — AI proposes, humans decide. The pipeline generates options and evidence; it doesn't ship code autonomously.

The skill is open in the Formspec repository. Run `/chaos-test` in Claude Code.
