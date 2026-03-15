# Launch Blog Post Proposals

**Date**: 2026-03-15
**Context**: Content moved off the marketing landing page during the site rebuild (`0001-marketing-site-rebuild.md`). These are the stories that matter but don't belong on the billboard — they belong where someone goes to learn more after the demo convinced them.

---

## Post 1: "ChatGPT for Forms" — Why Structured Specs Make AI Reliable

**Audience**: Technical decision-makers, AI-curious PMs, developers evaluating AI-augmented tooling.

**Thesis**: AI generating forms isn't new. AI generating forms *that are guaranteed to be valid* is. The difference is the spec — when every field, rule, and constraint is defined in a machine-verifiable schema, AI becomes a reliable tool instead of a liability. The model generates data, not code. Schema validation catches errors before anything runs.

**Key points**:
- The "ChatGPT for forms" pitch, explained honestly: what it can do today, what it can't, and why the architecture makes the difference
- Why JSON Schema validation is the constraint that makes AI generation trustworthy — the model can hallucinate all it wants, invalid output gets rejected before it reaches the form
- "AI-legible by design" — not because we built for AI, but because we built structured data that any system (including AI) can read and write reliably
- Demo: give Claude/GPT the Formspec JSON Schema and a plain-English description of a form. Show what comes out. Show the validation catching errors. Show the form rendering.
- The honest scope: AI can generate definitions and pre-fill responses. It can explain validation errors in plain language. It cannot (and shouldn't) modify validation rules at runtime.

**Tone**: Confident but grounded. This is the post that earns the "ChatGPT for forms" comparison on the landing page. If someone clicks through from the hero note, this is where they land.

---

## Post 2: The Origin Story — Why We Built a Form Specification

**Audience**: Civic tech community, government innovation teams, nonprofit technologists, anyone who's fought with forms in public service.

**Thesis**: We watched civic tech organizations — grant programs, tribal nations, clinical researchers, field inspectors — all drowning in the same problem. Forms are brutally hard to build, maintain, and submit correctly. Legacy tools (XForms, ODK) handle the complexity but are stuck in XML and 2003-era tooling. Modern tools (Typeform, Google Forms, JotForm) have great UX but can't handle conditional logic, calculated fields, multi-format output, or offline operation. The gap between "easy to use" and "powerful enough" has been open for 20 years.

**Key points**:
- The specific pain: a tribal nation filing annual reports that need to work offline, a grants program that collects data once but needs it in three formats, a clinical intake form with 200 fields of conditional logic
- Why nobody solved this: the problem is genuinely hard. You need a specification layer that separates data/logic from presentation, with enough rigor for server-side re-validation but enough simplicity for a single developer to implement
- The insight: AI tools now make building structured platforms feasible in ways they weren't before. A JSON specification clean enough for machines to work with makes AI a tool, not a gamble. But the spec works the same whether a human or a model builds the form.
- What Formspec is and isn't: it's the form engine (data, logic, validation, rendering). It's not hosting, not admin, not workflows. That's your stack.

**Tone**: Personal, specific, earnest. Name real scenarios. This is the founding story that was cut from the hero — it deserves a full telling, not a subtitle.

---

## Post 3: From XForms to Formspec — 20 Years of Form Specifications

**Audience**: Developers, standards nerds, anyone who's worked with XForms/ODK/XLSForm, W3C specification enthusiasts.

**Thesis**: XForms (2003, W3C) had the right ideas — reactive binds, conditional visibility, calculated fields, model-view separation. It was genuinely ahead of its time. But it was XML-native in a world that moved to JSON, required specialized tooling, and never got mainstream adoption outside of data collection (ODK/Kobo) and government (IBM Forms). Formspec takes the lessons — the things XForms got right — and rebuilds them for modern tooling.

**Key points**:
- What XForms got right: model/view separation, bind expressions, instance data, submission targets, conditional relevance. These are genuinely good ideas that the web development mainstream never absorbed.
- What XForms got wrong (or what the world outgrew): XML verbosity, XPath complexity, browser plugin dependency, lack of modern developer tooling
- The direct lineage: Formspec's `bind` system maps to XForms binds. FEL maps to XPath expressions but is deterministic and side-effect-free. Conditional relevance, calculated values, and constraint validation are conceptual descendants.
- What's new: JSON-native everything, JSON Schema validation, dual TypeScript/Python implementations, the mapping engine for output transformation, theme/component separation, web components
- Why now: the JavaScript ecosystem matured (reactive signals, Chevrotain for parsing), JSON became the lingua franca, and AI made structured specifications more valuable than ever

**Tone**: Technical, respectful of prior art, detailed. This is the post that makes senior engineers nod and say "they know what they're doing." It's the credibility builder for the developer section's lead line.

---

## Post 4: How Formspec Works — A Technical Deep Dive

**Audience**: Developers who want to understand the architecture before committing.

**Thesis**: A complete technical walkthrough of the specification and its implementations.

**Key points**:
- The three tiers: Core (data & logic), Theme (presentation), Components (interaction) — and why the separation matters
- FEL walkthrough: the expression language, its grammar, why it's deterministic and side-effect-free, what you can do with it
- Validation model: bind constraints vs shape rules, error/warning/info severity, path-based targeting with wildcards
- The dual implementation: TypeScript engine (reactive signals, Chevrotain parsing) and Python evaluator (server-side re-validation). Same spec, same results, different runtimes.
- Mapping engine: define output transformations declaratively. Collect once, output to any shape.
- Static linting: catch definition errors before deployment
- JSON Schema: the structural truth layer. Every definition is validated before it runs.
- Code examples throughout — real API calls, real definitions, real output

**Tone**: Documentation-grade. Thorough but not academic. Show code early and often. This is the post a developer reads before they `npm install`.

---

## Post 5: Building Government-Grade Forms Without a Vendor Contract

**Audience**: Government CIOs, IT directors, procurement officers, civic tech evaluators.

**Thesis**: Most form tools lock your logic, your data, and your users inside a vendor platform. When the contract ends — or the vendor pivots — your forms die with it. Formspec is an open specification: your form definitions are portable files you own. No vendor lock-in by design.

**Key points**:
- The lock-in problem in government: case studies of agencies burned by vendor dependencies (anonymized if needed, or reference public procurement failures)
- What "open" actually means: MIT license, portable JSON files, no runtime phone-home, self-hostable, no telemetry
- Behavior/presentation separation: why it matters for long-term maintainability (swap renderers without rewriting rules, swap backends without rewriting forms)
- Provably correct definitions: JSON Schema validation + static linting means invalid definitions never reach production. You can audit a form definition without running it.
- Total cost of ownership: free engine, free spec, bring your own hosting. The cost is developer time to integrate, not license fees.
- Comparison (honest, not snarky): how Formspec's approach compares to Salesforce Forms, Microsoft Forms, Adobe Experience Manager, Google Forms for government use cases

**Tone**: Sober, authoritative, vendor-neutral. This is the post a CIO forwards to their procurement team. No marketing language — just facts and architecture.

---

## Publishing Strategy

**Priority order** (for launch):
1. Post 2 (Origin Story) — establishes why this exists. Best for social sharing.
2. Post 1 (ChatGPT for Forms) — earns the hero note. Link from the landing page.
3. Post 4 (Technical Deep Dive) — serves developers evaluating the project.
4. Post 3 (XForms to Formspec) — niche but high-credibility for the right audience.
5. Post 5 (Government-Grade Forms) — best saved until there's at least one real deployment to reference.

**Where to publish**: GitHub repo `/blog/` directory as markdown, linked from the site footer once live. Consider cross-posting Post 1 and Post 2 to dev.to, Hacker News, and relevant civic tech newsletters.

**Timing**: Posts 1–3 ready for launch. Post 4 when the API docs are stable. Post 5 when there's a real-world deployment story to anchor it.
