---
description: "Multi-phase visual design review: assess → generate proposals → select winner → cross-review"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, Skill
argument-hint: <target — URL, component name, page, or area to review>
---

# Visual Design Review Pipeline

A 4-phase orchestration that produces a vetted visual design proposal through assessment, parallel exploration, adjudication, and cross-functional review.

**Target**: `$ARGUMENTS` — the URL, component, page, or area to review. If empty, ask the user what to review before proceeding.

Create the review directory at the start: `thoughts/studio/visual-reviews/YYYY-MM-DD-{slug}/`

Create these subdirectories immediately:
- `screenshots/` — all `.png` screenshots and `.txt` DOM snapshots
- `proposals/` — Phase 2 design proposals
- `reviews/` — Phase 4 cross-functional reviews

Phase 1 and Phase 3 outputs (`handoff-brief.md`, `adjudication.md`) and the final
`README.md` and `final-report.md` stay at the root level.

```
YYYY-MM-DD-slug/
  README.md
  handoff-brief.md
  adjudication.md
  final-report.md
  screenshots/
    pass1-01-initial.png
    pass1-02-field-selected.png
    ...
    verify-01-landing.png
  proposals/
    conservative.md
    evolutionary.md
    density.md
  reviews/
    service-designer.md
    scout.md
```

Use `{review_dir}` to refer to the root. Screenshots always go in `{review_dir}/screenshots/`.

---

## Phase 1: Visual Assessment & Handoff Brief

Launch the `formspec-specs:formspec-visual-designer` agent in the **foreground**. It must run its full Visual Domino Method (screenshot → DOM → code) and produce a handoff brief.

**Prompt:**

```
You are conducting a visual design assessment of: {$ARGUMENTS}

Run the full Visual Domino Method:

### Pass 1: Screenshot
Take a screenshot of the target and save to `{review_dir}/screenshots/pass1-01-initial.png` (number sequentially for additional captures). Study it. Write down your raw visual impressions BEFORE inspecting anything else — what draws the eye, what feels off, what works, what doesn't. Be honest and specific.

### Pass 2: DOM Inspection
Take a DOM snapshot and save to `{review_dir}/screenshots/dom-01-initial.txt`. Trace the causal chains from every visual issue you noted in Pass 1. Document: element → class/style → computed value → why it's wrong.

### Pass 3: Code
Read the source files (CSS, components, tokens, theme). Follow each domino chain to the first domino. Classify every issue: token tweak, CSS fix, component restructure, design system revision, or redesign.

### Deliver Your Verdict
State your overall verdict (one of the five levels). Be definitive.

### Produce the Handoff Brief
After your assessment, write a handoff brief and save it to:
`{review_dir}/handoff-brief.md`

The handoff brief MUST contain:

1. **Current State** — 2-3 sentences describing what the target looks like now, with the screenshot path
2. **Verdict** — Your verdict level and one-sentence justification
3. **Visual Problems** — Numbered list of every issue found, each with:
   - What's wrong (visual symptom)
   - Why it's wrong (the domino chain)
   - Where the first domino is (file + line or token name)
4. **Design Constraints** — Non-negotiable rules any proposal must follow:
   - Formspec spec requirements (cite sections)
   - Accessibility requirements
   - Responsive requirements
   - Existing design system elements that MUST be preserved
5. **Design Direction** — What "right" looks like for this target:
   - Visual hierarchy goals
   - Spacing/density intent
   - Color/contrast guidance
   - Typography guidance
   - Interaction state treatment
6. **Scope Boundaries** — What's in scope for proposals and what's not
7. **Success Criteria** — 3-5 concrete, testable statements that define a successful redesign (e.g., "Primary action button is the first thing the eye hits", "All field states are visually distinguishable at arm's length")

The brief should be detailed enough that a designer who has never seen this codebase can produce a valid proposal from it alone.
```

Print a one-line status: the verdict level and problem count. Then proceed immediately to Phase 2.

---

## Phase 2: Parallel Proposal Generation

Launch **3 `frontend-artisan` agents** in parallel using `model: "haiku"`. Each gets the handoff brief but a different design direction to explore. The visual-designer's brief constrains WHAT must be fixed — the proposals explore HOW.

Before launching, read the handoff brief from disk to get the exact contents.

**Prompt template** (vary the `{direction}` for each):

Directions to assign (pick 3 that make sense given the verdict):
- **Conservative**: Minimal visual changes. Fix every issue in the brief through token adjustments and targeted CSS. Preserve the existing visual language. Prove the current system CAN work.
- **Evolutionary**: Moderate restructuring. Improve the design system where it's incoherent, restructure components where the markup is fighting the CSS. The current direction is right but the execution needs work.
- **Revolutionary**: Bold rethink. If the visual-designer's verdict was "redesign" or "design system revision", this is the agent that explores what a clean-slate approach looks like. New visual language, new spatial model, new component structure.
- **Density-focused**: Optimize for information density and scannability. Forms are work — minimize visual noise, maximize data-per-viewport.
- **Warmth-focused**: Optimize for approachability and comfort. Forms are intimidating — make them feel human, patient, and clear.

```
You are producing a visual design proposal for a Formspec component/page.

## Your Direction: {direction}
{one-sentence description of the direction}

## Handoff Brief
{contents of handoff-brief.md}

## Your Task

1. **Invoke the `/frontend-design` skill** to guide your aesthetic thinking
2. Study the handoff brief carefully — every numbered problem must be addressed
3. Produce a concrete proposal that includes:
   - **Design rationale** — 3-5 sentences on your approach and why it solves the problems
   - **Visual changes** — For each problem in the brief, your specific solution
   - **Token/CSS changes** — Exact values or new tokens you'd introduce
   - **Component changes** — Any structural markup changes needed
   - **Implementation sketch** — Key code snippets (CSS, JSX/TSX) showing the critical changes. Not a full implementation — just enough to evaluate the visual approach.
4. Verify your proposal against every Success Criterion in the brief
5. Save your proposal to: `{review_dir}/proposals/{direction_slug}.md`

## Rules
- You MUST address every problem in the handoff brief. Don't cherry-pick.
- You MUST respect every Design Constraint. Constraints are non-negotiable.
- You MAY go beyond the brief if you spot additional issues — but label them as "bonus findings."
- Your implementation sketch must be real code, not pseudocode.
- Include enough visual detail that someone can evaluate the proposal without running code.
```

Launch all 3 agents in a **single message** so they run concurrently. Use `run_in_background: true` for all three — proceed to wait for all to complete.

---

## Phase 3: Adjudication

Once all proposals are saved, re-launch the `formspec-specs:formspec-visual-designer` agent in the **foreground** with the original handoff brief and all proposals.

**Prompt:**

```
You are adjudicating visual design proposals for: {$ARGUMENTS}

## Your Handoff Brief
Read: {review_dir}/handoff-brief.md

## Proposals to Review
Read all proposal files in: {review_dir}/proposals/*.md

## Your Task

For each proposal, run a compressed version of the Visual Domino Method — you can't screenshot them, but you CAN:
1. **Visualize** — Read the implementation sketches and mentally render them. What would this look like?
2. **Trace** — Does the proposal actually fix the domino chains you identified, or does it just move the symptoms?
3. **Verify** — Check every Success Criterion against the proposal. Pass/fail each one.

Then produce:

### Comparative Analysis
A table scoring each proposal on:
| Criterion | Proposal A | Proposal B | Proposal C |
|-----------|-----------|-----------|-----------|
| (each success criterion) | pass/fail + note | ... | ... |
| Addresses all problems | count/total | ... | ... |
| Respects all constraints | yes/no + violations | ... | ... |
| Design coherence | 1-5 + note | ... | ... |
| Implementation feasibility | 1-5 + note | ... | ... |

### The Verdict
Select ONE winning proposal. You may also recommend specific elements from losing proposals to incorporate. State:
1. **Winner**: which proposal and why
2. **Cherry-picks**: any elements from other proposals to fold in
3. **Remaining concerns**: anything the winner still gets wrong
4. **Implementation priority**: ordered list of changes, most impactful first

Save to: `{review_dir}/adjudication.md`
```

Print a one-line status: winner name and verdict. Then proceed immediately to Phase 4.

---

## Phase 4: Cross-Functional Review

Launch the `formspec-specs:formspec-service-designer` and `formspec-specs:formspec-scout` agents **in parallel** to review the winning proposal from their respective angles.

### Service Designer Review

```
You are reviewing a visual design proposal from the user experience perspective.

## Context
The visual-designer agent assessed {$ARGUMENTS}, generated a handoff brief, solicited proposals, and selected a winner.

Read these files:
- Handoff brief: {review_dir}/handoff-brief.md
- Winning proposal: {review_dir}/proposals/{winner_slug}.md
- Adjudication: {review_dir}/adjudication.md

## Your Task

Review the winning proposal through the lens of user interaction and experience:

1. **User journey impact** — Does this visual change improve or harm the user's ability to complete the form? Are there interaction patterns that look good but work poorly?
2. **State communication** — Can users distinguish all field states (required, optional, error, disabled, readonly, protected) at a glance? The visual-designer evaluated this visually — you evaluate it from the user's mental model.
3. **Cognitive load** — Does the new design reduce or increase cognitive load? Are there visual changes that look better but require users to re-learn patterns?
4. **Edge cases** — What happens with: empty states, very long labels, validation errors on every field, deeply nested groups, 20+ fields on one page, RTL layouts?
5. **Progressive disclosure** — Does the visual hierarchy support the form's information architecture?

Produce:
- **Endorsement or objection** — Is this proposal safe to implement from a UX perspective?
- **Interaction concerns** — Specific issues that would harm usability
- **Suggested modifications** — Changes that would improve UX without undermining the visual direction

Save to: `{review_dir}/reviews/service-designer.md`
```

### Scout Review

```
You are reviewing a visual design proposal from a code quality and architecture perspective.

## Context
The visual-designer agent assessed {$ARGUMENTS}, generated a handoff brief, solicited proposals, and selected a winner.

Read these files:
- Handoff brief: {review_dir}/handoff-brief.md
- Winning proposal: {review_dir}/proposals/{winner_slug}.md
- Adjudication: {review_dir}/adjudication.md

## Your Task

Review the winning proposal's implementation approach:

1. **Code impact assessment** — Read the actual source files that would be modified. How many files? How invasive are the changes? Are there hidden dependencies?
2. **Design system coherence** — Do the proposed token/CSS changes fit the existing system, or do they create a parallel system? If the proposal introduces new tokens, do they follow naming conventions?
3. **Component architecture** — Do any proposed structural changes violate the component model? Would they break other consumers of the same components?
4. **Domino check** — The visual-designer traced domino chains from symptoms to root causes. Does the proposed fix actually address the first domino, or does it paper over a deeper issue?
5. **Spec compliance** — Do the proposed changes comply with the Formspec Theme and Component specs? Grep for relevant spec sections and verify.

Produce:
- **Implementation viability** — Can this be implemented cleanly, or does it require uncomfortable compromises?
- **Architecture concerns** — Changes that would create tech debt or violate project conventions
- **Suggested modifications** — Changes that would improve implementation without undermining the visual direction
- **Estimated blast radius** — Files and components affected, risk of unintended side effects

Save to: `{review_dir}/reviews/scout.md`
```

Launch both agents in a **single message** so they run concurrently.

---

## Phase 5: Final Report

After all reviews complete, synthesize a final report. Read all artifacts from the review directory.

Produce a summary containing:

1. **Executive Summary** — One paragraph: what was reviewed, what the verdict was, what was proposed, and whether reviewers endorsed it
2. **Winning Proposal** — Name, direction, key changes
3. **Review Consensus** — Where all three agents (visual-designer, service-designer, scout) agree
4. **Open Concerns** — Where reviewers disagree or flag risks
5. **Implementation Plan** — Ordered list of changes to make, incorporating all reviewer feedback
6. **Files to Modify** — Concrete list of files with what changes each needs

Save to `{review_dir}/final-report.md` and present the executive summary to the user.

Present the implementation plan and ask the user if they'd like to proceed with implementation. If the user confirms, dispatch the `frontend-artisan` agent to implement the winning proposal per the final report, then proceed to Phase 6. If the user declines or wants to implement themselves, tell them to run Phase 6 manually after implementation.

---

## Phase 6: Visual QA Validation

After implementation is complete, re-launch the `formspec-specs:formspec-visual-designer` agent in the **foreground** to validate the result against the original assessment.

**Prompt:**

```
You are conducting a visual QA validation of: {$ARGUMENTS}

This target was previously assessed, redesigned, and implemented. Your job is to verify the implementation actually fixed the problems — not rubber-stamp it.

## Reference Artifacts
Read these files:
- Original handoff brief: {review_dir}/handoff-brief.md
- Winning proposal: {review_dir}/proposals/{winner_slug}.md
- Final report: {review_dir}/final-report.md

## Your Task

Run the full Visual Domino Method again — fresh eyes, no assumptions:

### Pass 1: Screenshot
Take a new screenshot and save to `{review_dir}/screenshots/verify-01-post-impl.png` (number sequentially). Study it WITHOUT re-reading the handoff brief first. Write down your raw visual impressions. What draws the eye? What feels off? What works?

### Pass 2: Compare Against Success Criteria
Now read the handoff brief. For each Success Criterion, evaluate pass/fail against what you see in the new screenshot. Be honest — if a criterion technically passes but barely, say so.

### Pass 3: Regression Check
Compare the new screenshot against the original problems list. For each problem:
- **Fixed** — The domino chain is broken, the visual symptom is gone
- **Partially fixed** — The symptom is reduced but not eliminated, or the fix introduced a new but milder issue
- **Not fixed** — Still present
- **Regressed** — The fix made this worse or introduced a new problem

### Pass 4: New Issues Scan
Take a DOM snapshot (save to `{review_dir}/screenshots/dom-verify-01.txt`). Look for problems that did NOT exist in the original assessment. For each new issue, classify it:
- **Regression** — Caused by the implementation. Was not present before, is present now.
- **Pre-existing** — Was present before the redesign but was missed by the original assessment. NOT caused by the implementation — it was already broken.

Be precise about this distinction. A regression is the implementation's fault. A pre-existing error is an older bug that the assessment didn't catch. Both matter, but they get handled differently.

Look for: visual artifacts, broken states, spacing collisions, styling that looks fine in the default state but breaks in edge cases (error states, empty states, overflow, narrow viewport), token inconsistencies, component misalignment.

### Deliver Your QA Verdict

State one of:
- **PASS** — All success criteria met, all original problems fixed, no regressions. Ship it.
- **PASS WITH NOTES** — All critical problems fixed, success criteria met, but minor issues remain. Document them and ship.
- **FAIL — Regressions** — The implementation introduced new problems worse than what it fixed. Do not ship.
- **FAIL — Incomplete** — Significant original problems remain unfixed. Back to implementation.

Produce a QA report:

| Success Criterion | Status | Evidence |
|---|---|---|
| (each criterion from brief) | PASS / FAIL | What you see |

| Original Problem | Status | Notes |
|---|---|---|
| (each problem from brief) | Fixed / Partial / Not Fixed / Regressed | Details |

| New Issues: Regressions | Severity | Details |
|---|---|---|
| (issues caused by implementation) | Critical / Minor | What's wrong and where |

| New Issues: Pre-Existing Errors | Severity | Details |
|---|---|---|
| (issues that predate the redesign) | Critical / Minor | What's wrong, visible symptom, suspected layer |

Save to: `{review_dir}/qa-validation.md`
```

Print the QA verdict to the user. If FAIL, recommend next steps (which problems to address and which agent to dispatch).

**If the QA report contains pre-existing errors**, launch one `formspec-specs:formspec-scout` agent (in the background) to investigate them. The scout traces visual symptoms to root dominos across the layer stack — these pre-existing bugs were missed by the original assessment and likely have architectural causes worth understanding.

**Scout prompt:**

```
The visual QA validation of {$ARGUMENTS} found pre-existing errors — visual bugs that existed BEFORE the redesign and were missed by the original assessment. These are NOT regressions from the implementation.

Read the QA report: {review_dir}/qa-validation.md
Read the original handoff brief for context: {review_dir}/handoff-brief.md

For each pre-existing error in the "Pre-Existing Errors" table:

1. **Locate the symptom** — Read filemap.json, find the component/CSS/token file responsible
2. **Trace the domino chain** — Follow the visual symptom from DOM → CSS → token/theme → component spec. Where is the first domino?
3. **Classify the root cause** — Is this a token gap, a CSS specificity issue, a missing component state, a spec gap, a theme cascade failure, or a design system inconsistency?
4. **Assess blast radius** — Does this same root cause affect other components or pages?

Produce a diagnosis for each pre-existing error and save to: {review_dir}/reviews/scout-preexisting-diagnosis.md

Format each finding as:
- **Symptom**: (what the QA saw)
- **Root domino**: (layer, file, line/token)
- **Classification**: (token gap / CSS issue / missing state / spec gap / cascade failure / design system inconsistency)
- **Blast radius**: (isolated to this component / affects N other components / systemic)
- **Recommended fix**: (one sentence — what to change and where)
```

Print a one-line summary of the scout's findings when it completes (e.g., "Scout found 3 pre-existing issues: 2 token gaps (systemic), 1 missing error state (isolated)").
