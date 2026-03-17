# MCP Chaos Test

A 4-phase pipeline that stress-tests the formspec-mcp server through simulated user testing, architectural root-cause analysis, independent review, and guided implementation.

Each phase ends with a **checkpoint** — present findings to the user and wait for explicit approval before proceeding to the next phase.

## Setup

Save all artifacts to `thoughts/chaos-test/YYYY-MM-DD/`. Create the directory at the start.

---

## Phase 1: Blind User Testing

### 1a. Generate 5 Personas

Create 5 distinct personas by randomizing across these dimensions:

| Dimension | Pool |
|-----------|------|
| **Experience** | never used a form builder / used Google Forms / used Typeform or JotForm / built forms programmatically / API-first developer |
| **Role** | PM, designer, admin assistant, business analyst, teacher, HR manager, nonprofit director, event coordinator, researcher, freelancer |
| **Personality** (pick 2) | impatient, meticulous, exploratory, goal-focused, easily confused, overly confident, cautious, creative, perfectionist, chaotic |
| **Working style** | reads everything first / dives in immediately / asks lots of questions / tries random things / methodical step-by-step |

Give each persona a name, one-sentence background, and a concrete reason they need a form today. The form they build should emerge naturally from their role and situation — don't prescribe form types.

**Coverage requirements**: at least one beginner, one intermediate, one expert. Spread across different roles. No two personas should have the same working style.

Present the 5 personas to the user in a table before spawning agents.

### 1b. Spawn Test Agents

For each persona, launch a `general-purpose` Task agent with `run_in_background: true`.

Use different models to simulate experience variance:
- Beginners: `model: "haiku"` (simulates less sophisticated reasoning)
- Intermediate: `model: "sonnet"`
- Expert: `model: "sonnet"` or `model: "opus"` for the most experienced persona

**Prompt template** (fill in persona details):

```
You are {name}, {background}. {reason_for_needing_a_form}.

You've been asked to try out a new form-building tool. You have access to it through MCP tools — look for tools that start with "mcp__formspec-mcp__formspec_".

YOUR TASK: Build a form you'd actually need in your role. Start from scratch. Explore the available tools, figure out what they do, and try to build your form.

PERSONALITY: {personality_traits}. WORKING STYLE: {working_style}.

CRITICAL RULES:
- You may ONLY use tools that start with "mcp__formspec-mcp__formspec_"
- You MAY also use "mcp__plugin_firebase_firebase__developerknowledge_search_documents" to look up Firebase/formspec documentation
- Do NOT use Read, Write, Edit, Grep, Glob, Bash, Task, or any filesystem tools
- Do NOT read source code, documentation files on disk, or CLAUDE.md
- Figure things out by trying things, reading error messages, and exploring
- If a tool call fails, read the error message carefully and adapt

As you work, keep a running log:
1. What you tried and what happened (include tool names and key parameters)
2. Moments of confusion or frustration
3. Error messages that were unhelpful, misleading, or that you couldn't recover from
4. Things that felt unintuitive (e.g., expected a parameter that didn't exist, naming was confusing)
5. Features you expected but couldn't find
6. Things that surprised you (good or bad)
7. How many attempts it took to accomplish each sub-task

Be authentic to your persona. If {name} would get frustrated and give up after 3 failures, do that. If they'd methodically try every permutation, do that. Don't break character.

When done (or stuck), write a structured final report:

## Form Summary
What you built, how far you got, approximate tool call count.

## Bugs
Things that are clearly broken. For each: exact reproduction steps, error text, what you expected vs what happened.

## UX Issues
Things that technically work but feel wrong. For each: what you tried, what happened, what would have been better.

## Confusion Points
Where you got lost and why. What would have helped.

## Feature Gaps
What you needed but couldn't do. How you worked around it (if you could).

## Praise
What worked well. What felt good. What you'd tell a colleague about.
```

### 1c. Compile Findings

After all 5 agents complete:

1. Read each agent's full output
2. Create a compiled report with:
   - **Summary table**: persona name, form type, complexity, fields created, approx tool calls, bugs found, overall success (completed / partial / abandoned)
   - **Deduplicated issue list**: merge similar issues across personas, note which personas hit each
   - **Category tags**: BUG / UX / CONFUSION / GAP / PRAISE
   - **Verbatim quotes** from persona reports as evidence
   - **Priority signal**: issues hit by 3+ personas → high priority, 2 → medium, 1 → low
3. Save to `thoughts/chaos-test/YYYY-MM-DD/phase1-findings.md`

**CHECKPOINT**: Present the compiled findings. Ask: *"Which issues should we trace through the stack? All of them, or a specific subset?"*

---

## Phase 2: Root Cause Analysis

For each approved issue, spawn a `code-scout` Task agent (use `subagent_type: "code-scout"`).

The formspec architecture stack, from deepest to shallowest:

```
spec (specs/*.md)
  → schema (schemas/*.json)
    → types (packages/*/src/types/)
      → engine (packages/formspec-engine/)
        → core (formspec-core — RawProject, handlers)
          → studio-core (formspec-studio-core — Project helpers)
            → mcp (formspec-mcp — tool schemas & descriptions)
```

**Code-scout prompt template**:

```
Analyze this issue found during blind user testing of the formspec-mcp server:

**Issue:** {description}
**Category:** {bug/ux/confusion/gap}
**Reproduction:** {steps from persona report}
**Hit by:** {which personas, count}

Trace this through the formspec stack. The layers from deepest to shallowest:

1. **spec** (specs/*.md) — Normative specification prose, behavioral semantics
2. **schema** (schemas/*.json) — JSON Schema constraints and structure
3. **types** (packages/*/src/types/) — TypeScript type definitions
4. **engine** (packages/formspec-engine/) — Form state management, FEL, signals, reactivity
5. **core** (formspec-core) — RawProject, handler registry, normalization, tree operations
6. **studio-core** (formspec-studio-core) — Project class, 51 helper methods, evaluation
7. **mcp** (formspec-mcp) — MCP tool schemas, descriptions, parameter mapping

For this issue, answer ALL of these questions:

1. **Root layer**: Where does the fix ACTUALLY belong? Not where the symptom appears — where the underlying cause lives. Read the actual code at each layer to confirm.

2. **Current behavior**: What does the code do now at the root layer? Show the specific code path.

3. **Monkeypatch check**: Is the current behavior at the symptom layer papering over a deeper issue? For MCP-layer issues specifically: is the MCP tool correctly translating between authoring vocabulary and spec semantics, or is it doing its own thing?

4. **Dependency inversion**: Does the proposed fix respect dependency direction? Deeper layers MUST NOT know about shallower ones. If fixing this requires the engine to know about MCP concepts, that's a dependency violation — find a different approach.

5. **Tech debt signal**: Does this issue indicate broader architectural debt? Is this a one-off bug, or part of a pattern you see elsewhere in the same layer?

6. **Proposed fix**: What's the actual solution, at the right layer? Be specific — which file, which function, what change.

7. **Cascade impact**: If we fix at the root layer, what changes upstream? Will shallower layers need updates too?

8. **TDD approach**: Describe the RED test (what fails now), GREEN implementation (minimum to pass), and EXPAND edge cases.
```

Launch up to 5 code-scout agents in parallel. After all complete, compile:

- **Layer heatmap**: which layers have the most root causes
- **Issues grouped by root layer**: so fixes can be batched
- **Tech debt patterns**: multiple issues pointing to the same root cause
- **Dependency violations**: any proposed fixes that break layer direction
- **Recommended fix order**: accounting for masking effects (a fix in a deeper layer may resolve issues in shallower layers)

Save to `thoughts/chaos-test/YYYY-MM-DD/phase2-analysis.md`

**CHECKPOINT**: Present the analysis. Ask: *"Do these root-cause assessments look right? Any adjustments before the sanity check?"*

---

## Phase 3: Independent Sanity Check

Spawn ONE `general-purpose` Task agent with `model: "opus"`.

Give it ONLY the compiled findings and proposed fixes from Phase 2 — no codebase access, no file reading, no exploration. This is a raw, context-free assessment.

**Prompt**:

```
You are an independent technical reviewer. You have NO access to the codebase and NO context about this project's history or internal conventions. You've been given a set of issues found during user testing of a form-building tool's API, along with proposed fixes at specific architectural layers.

Your job is to be skeptical and find problems with the proposed approach.

For each proposed fix, assess:

1. **Root cause vs symptom**: Does this fix the cause or just the symptom? Is the original issue still possible after this fix, just through a different path?

2. **Layer correctness**: Is the proposed layer the right place? Would fixing it higher or lower be simpler, more correct, or more maintainable?

3. **Conflict detection**: Could any of these fixes interfere with each other? Are there hidden ordering dependencies?

4. **Over-engineering check**: Is any fix adding more complexity than the problem warrants? Is there a simpler solution being overlooked? Would "just update the error message" or "just add a parameter" actually solve the user's problem?

5. **Risk assessment**: Which fixes are low-risk (localized, well-understood) vs high-risk (touching core abstractions, wide blast radius)?

6. **Priority ranking**: If you could only ship 3 fixes this week, which 3 and why?

7. **Pattern detection**: Do you see a systemic issue — like multiple issues all stemming from the same architectural gap — that might warrant a different approach entirely (e.g., a new abstraction, a design change, rather than N individual fixes)?

Push back HARD on anything that smells like:
- Adding a layer to avoid touching a deeper one
- Moving complexity around instead of removing it
- Fixing at the MCP level what should be fixed in the engine
- Over-engineering a simple problem

ISSUES AND PROPOSED FIXES:
{paste the full Phase 2 analysis here}
```

Save to `thoughts/chaos-test/YYYY-MM-DD/phase3-review.md`

**CHECKPOINT**: Present the sanity check results alongside the Phase 2 analysis. Ask: *"Which fixes are approved for implementation? Any changes based on the review?"*

---

## Phase 4: Parallel Implementation

Group approved fixes by stack layer. For each layer group, spawn a `code-scout` Task agent.

**Implementation agent prompt**:

```
You are implementing approved fixes for the **{layer_name}** layer of the formspec project.

ASSIGNED ISSUES:
{numbered list with issue descriptions and approved fix approach}

CONTEXT FROM ANALYSIS:
{relevant excerpts from Phase 2 root-cause analysis for these issues}

REVIEWER NOTES:
{relevant pushback or guidance from Phase 3 sanity check}

WORKFLOW — follow this exactly:
1. READ the relevant source code first. Understand the current behavior completely before making any change.
2. QUESTION the proposed fix. Now that you see the actual code, does the fix still make sense? If not, STOP — explain what you found and what you'd do instead. Do not implement a fix you don't believe in.
3. If you discover the issue is actually in a DIFFERENT layer than proposed, STOP — explain the evidence. Don't fix the wrong thing.
4. RED: Write a failing test that demonstrates the bug. Run it. Confirm it fails for the right reason.
5. GREEN: Implement the minimum change to make the test pass. No gold-plating.
6. EXPAND: Add edge case tests. Make them pass.
7. VERIFY: Run the full test suite for the affected package. Zero regressions.

ATTITUDE:
- Be introspective. Ask yourself "is this actually fixing the problem, or am I just moving it?"
- If something feels like a monkeypatch, say so and propose an alternative.
- If you find related issues while working, note them but do NOT fix them — they're out of scope.
- Prefer deleting code to adding code when possible.
- Don't add abstractions, helpers, or wrappers unless the fix genuinely requires them.

REPORT (write this at the end):
- What you changed and why (file paths + brief description)
- Any deviations from the proposed fix (and why you deviated)
- Tests added (file paths + what they cover)
- New issues discovered while working (for future investigation)
- Verification: which test commands to run to confirm everything works
```

Launch layer groups in parallel. After all complete, compile a final report:

- Changes made per layer (with file paths)
- Deviations from proposed fixes (with reasoning)
- New issues discovered
- Full verification command sequence

Save to `thoughts/chaos-test/YYYY-MM-DD/phase4-implementation.md`

**FINAL**: Present the implementation summary. Tell the user which test commands to run for full verification.

---

## Quick Reference

| Phase | Agent Type | Model | Parallel? | Checkpoint? |
|-------|-----------|-------|-----------|-------------|
| 1 - Testing | general-purpose | haiku/sonnet/opus by experience | Yes (5) | Yes |
| 2 - Analysis | code-scout | (default) | Yes (up to 5) | Yes |
| 3 - Review | general-purpose | opus | No (1 agent) | Yes |
| 4 - Implementation | code-scout | (default) | Yes (by layer) | Final report |
