# Formspec Requirement-to-Form Benchmark (v0)

This benchmark measures **requirement-to-form authoring correctness**: given a
plain-English problem statement, can a form author (human or LLM) produce a
Formspec artifact set that passes the Python validator?

Each task ships a natural-language `requirement.md`, a `reference/` directory
containing a known-good answer, and a `meta.json` describing its difficulty and
feature coverage. The runner invokes the Formspec validator on a candidate
directory and reports whether it validates.

## Layout

```
benchmarks/
  README.md
  run_benchmark.py
  test_benchmark_harness.py
  tasks/
    invoice/
      requirement.md         # the prompt a domain expert would write
      reference/             # the expected artifact set (definition + sidecars)
      meta.json              # id, difficulty, feature_tags, tiers_covered
    clinical-intake/ ...
    grant-application/ ...
    grant-report/ ...
```

## How to run it

```bash
# List all tasks with their difficulty and one-line summary.
python3 benchmarks/run_benchmark.py list

# Score a candidate directory against a known task.
python3 benchmarks/run_benchmark.py score invoice path/to/candidate/
```

The harness smoke tests also confirm every task's reference validates cleanly:

```bash
python3 -m pytest benchmarks/test_benchmark_harness.py -v
```

## Scoring

The scoring function is deliberately simple — it can be tightened later once
the benchmark has more signal.

```
validates cleanly (totalErrors == 0)  ->  1.0
otherwise                              ->  max(0, 1 - totalErrors / 10)
```

This is a coarse signal, not a grade. Future refinements: weighting by error
severity, partial credit for reaching specific validation passes, or
similarity-to-reference metrics. For v0, "does it validate?" is the
falsifiable question — the spec already has authoritative opinions about what
"valid" means, and that is exactly what the benchmark tests.

## Adding a new task

A task is three files and a directory:

1. `tasks/<id>/requirement.md` — 3–10 sentences in author voice. No spec
   jargon. Describe the form as the person who wants it built would describe
   it: what gets collected, what has to be true about the answers, what
   calculations are required, what export formats are needed.
2. `tasks/<id>/reference/` — a directory of JSON artifacts (`definition.json`,
   optionally a `component.json`, `theme.json`, `mapping.json`,
   `changelog.json`, etc.). This must itself pass
   `python3 -m formspec.validate <dir> --registry registries/formspec-common.registry.json`.
3. `tasks/<id>/meta.json` — `{ "id", "difficulty", "feature_tags",
   "tiers_covered" }`. Difficulty is one of `"novice"`, `"intermediate"`,
   `"expert"`.

The harness test `test_reference_validates_cleanly` is the gate: if the
reference doesn't validate, the task cannot be checked in.

## Why response fixtures are excluded

The reference directories ship only the form definition and its sidecars
(theme, component, mapping, changelog) — not the `fixtures/` response payloads
that appear alongside the full examples. Fixtures trigger a
runtime-evaluation pass that depends on registry entries for extension data
types (e.g. `x-formspec-email`, `x-formspec-currency-usd`). Whether the
form's *definition* is correct is independent of whether a specific
response can be re-evaluated clean; the benchmark tests the authoring
question, so we keep the artifact set focused on the authoring output.

## How this plugs into an MCP-driven LLM loop (follow-on)

The follow-on piece wraps this benchmark in an MCP-driven author-and-grade
loop: feed the LLM the task's `requirement.md` as the user prompt, give it
access to the Formspec MCP tools (draft / edit / validate / lint), let it
iterate on a candidate directory until its self-check reports clean or a
round budget is exhausted, then call `run_benchmark.py score` to produce the
final score. The result is a per-task record of score, round count, and
diagnostics at the first and last iteration — a concrete measurement of how
well the current model + toolchain combination authors forms against the
spec.
