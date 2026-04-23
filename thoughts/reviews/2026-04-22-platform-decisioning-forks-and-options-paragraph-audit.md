# Platform Decisioning Paragraph Audit

Source: [`thoughts/specs/2026-04-22-platform-decisioning-forks-and-options.md`](../specs/2026-04-22-platform-decisioning-forks-and-options.md)

Date: 2026-04-22

## Resolution Note

Addressed in the source document on 2026-04-22 by adding a status vocabulary, defining local source labels, splitting overloaded paragraphs, separating forks-under-lean from true open forks, labeling counsel-dependent legal claims, and resolving the dCBOR/JWS, Restate/engine-choice, per-layer-tags/1.0, `ct_merkle`/primary-store, and append-authority/commit-status conflicts. The table below remains the original issue register.

## Overall Verdict

The document is useful and mostly coherent, but it is not yet clean enough to be a decisioning surface. The main defect is status drift: several items are described as committed leans in Part A and as no-default open forks in Part B. That weakens the core distinction the document exists to make.

Second defect: many paragraphs fail their own isolation test. They are technically rich, but several pack two to five decisions into one paragraph, mix current lean with future profile, or lean on undefined references such as "the synthesis," "accepted signature-profile workflow slice," "G-5," and "T4."

Recommended fix order:

1. Define a status taxonomy at the top: `lean`, `fork under current lean`, `true open fork`, `kill criterion`, `constraint`, and `accepted external dependency`.
2. Split Part B into `Open Forks With Current Lean` and `True No-Default Forks`.
3. Split the overloaded Part A paragraphs that combine byte format, identity, custody, runtime, and marketing claims.
4. Add a short local glossary for named mechanisms and source notes so the document stays self-contained.
5. Mark legal/regulatory statements as counsel-dependent unless already reviewed.

## Frontmatter And Structure

| Lines | Verdict | Audit |
|---|---|---|
| 1-14 | Tighten | Metadata says "no repository paths" and "no phased roadmap framing"; the body still relies on named repo-internal artifacts and sequencing claims. Reword to "minimal repository paths" and "not a roadmap, but includes sequencing constraints," or remove the body references. |
| 16 | OK | Title is accurate, but "technical" understates the legal, product, and organizational content. Consider "technical and governance" if this remains mixed-scope. |
| 24, 160, 234, 252 | OK | Separators help; no issue. |
| 26, 162, 236, 254 | OK | Section headings are clear. Part B needs a stronger heading if it will contain forks that already have Part A leans. |

## Paragraph Audit

| ID | Lines | Verdict | Audit |
|---|---:|---|---|
| P001 | 18 | OK | Strong opener. It clearly defines "committed" as default, not sacred. |
| P002 | 20 | Tighten | Good standard, but the document does not satisfy it consistently. Keep this as a contract only if overloaded paragraphs are split. |
| P003 | 22 | Tighten | Useful provenance note, but "the 2026-04-22 full-stack synthesis" is undefined locally. Add a source note or appendix entry. |
| P004 | 30 | OK | Clear, testable architecture bar. "Eventually" weakens it; if this is a lean, say which stages may lack vectors today. |
| P005 | 32 | OK | Clean center-authority rule. "Impact times debt" should be `Imp x Debt` or briefly defined to match project vocabulary. |
| P006 | 34 | OK | Good center/adapter split. "Heavy cryptography profile" may need one example, because profiles can also be center-declared. |
| P007 | 38 | Split | Load-bearing but too dense. It defines three centers, lists five seams, paraphrases them, defines conformance impact, and gives reopen rules. Split into "three centers" and "five contracts." |
| P008 | 40 | OK | Good boundary note. It prevents readers from assuming open contracts are covered by the five seams. |
| P009 | 44 | OK | Clear proof priority. "Hostile reviewer" is vivid but maybe too informal for an architectural decision note. |
| P010 | 46 | Split | Overloaded. It combines signature pipeline, TypeID identity, dCBOR, JSON Schema truth, append cardinality, idempotency, and canonicalization scope. Split into custody pipeline and byte-oracle discipline. |
| P011 | 48 | OK | Clear distinction between intake click evidence and workflow signature semantics. Good reopen criterion. |
| P012 | 52 | Split | Important but too broad. It combines one timeline, watermarked projections, sealed response heads, vendor operation, record ownership, portability, decryption honesty, and federation reopen conditions. Split into logical ledger, projections, and custody language. |
| P013 | 54 | OK | Crisp engine-versus-ledger boundary. Reopen condition is concrete enough. |
| P014 | 56 | OK | Clear compensation posture. "Trellis append is commit authority" conflicts with open fork P073 unless Part B is recast as "pin remaining usage." |
| P015 | 60 | OK | Good operational lean. "Recommended Merkle mechanism over committed roots on one operational unit" is still a little abstract; define operational unit. |
| P016 | 62 | OK | Strong decision rule. "Two primaries create lawsuits" is rhetorically useful but might be too colloquial for external reuse. |
| P017 | 64 | OK | Good rejection paragraph. "Generic event stores" needs a local definition or example class to avoid overbreadth. |
| P018 | 68 | Tighten | Correct direction, but title is too long and mixes object class with exclusions. Split title or make it "COSE is the ledger-adjacent signing path." |
| P019 | 70 | Conflict | Part A says dCBOR beats JCS; Part B P063 says canonical encoding remains open. Reconcile by moving P063 to "JWS profile pressure under dCBOR lean" or downgrade this lean. |
| P020 | 72 | Tighten | Good cryptographic custody point. The phrase "where the spec says so" undercuts the paragraph unless it names which spec surface owns the PRK rule. |
| P021 | 76 | OK | Clear privacy-plane model. Define whether the four-layer chain is center architecture, product architecture, or both. |
| P022 | 78 | OK | Strong privacy finding. The paragraph is dense but stays on one topic: metadata and re-identification after shredding. |
| P023 | 80 | Tighten | Good hierarchy, but "at the center" is potentially ambiguous because zk/MPC profiles may still be center-declared. Say "center default." |
| P024 | 82 | OK | Clear default/profile split. Draft-risk trigger is a useful reopen condition. |
| P025 | 84 | Tighten | Correct witness distinction. Needs a sentence saying whether witness personalities are profiles, adapters, or both. |
| P026 | 86 | OK | Clear anti-redundancy rule. Good threat-model trigger. |
| P027 | 88 | OK | Strong and necessary. "Reopen never" is defensible here because it is honesty, not architecture, but it should be labeled as policy not technical immutability. |
| P028 | 92 | OK | Good scope control. No issue. |
| P029 | 94 | Tighten | Too thin for a paragraph titled "narrative." It names KMS patterns but does not say what the decision is beyond "use mature KMS." Add custody/key-destruction obligations or merge with P020/P022. |
| P030 | 96 | Tighten | Good rejection of bespoke auth crypto. "Derived from ledger grants" is load-bearing and undefined; clarify whether grants are source-of-truth claims or inputs to external authz systems. |
| P031 | 98 | OK | Clear adapter-tier standards bias. No issue. |
| P032 | 102 | Conflict | Part A chooses Restate-class reference path; Part B P066 says engine choice remains open. Either mark Restate as current implementation lean or move engine choice out of "no default yet." |
| P033 | 104 | OK | Strong single-language and JSON-center rule. "Compass research" needs glossary entry. |
| P034 | 106 | OK | Clear authoring-skin rule. No issue. |
| P035 | 110 | OK | Good envelope/profile distinction. "Lint relaxation" is precise and useful. |
| P036 | 112 | OK | Clear representation rationale. No issue. |
| P037 | 114 | Tighten | "Strict profiles require at least one anchor" may conflict with local/offline/no-external-anchor deployments. Name the strict profile or soften to "current strict profile." |
| P038 | 116 | OK | Good reserved-field discipline. The second sentence introduces unified-ledger sequencing; consider moving that to release shape if the paragraph is meant to be ADR 0003 only. |
| P039 | 118 | OK | Strong byte-authority rule. No issue. |
| P040 | 120 | OK | Good sequencing rule. "Velocity crises" is a little informal but clear. |
| P041 | 122 | Split | Too much packed in: second implementation, stranger corpus, G-5 naming, corpus freshness, pre-issuance economics, migration contract, and alternatives. Split into guard function and lifecycle/migration cost. |
| P042 | 126 | OK | Good section scope note. No issue. |
| P043 | 128 | Tighten | Valuable causal-order finding. It may overreach by prescribing DAG construction before the case-topology fork closes; mark as "candidate center pattern" rather than lean unless accepted. |
| P044 | 130 | OK | Strong leakage/projection-cost paragraph. It lacks an explicit reopen line, but the "no free lunch" ending functions as the decision. |
| P045 | 132 | OK | Clear default with legally triggered exceptions. No issue. |
| P046 | 134 | Tighten | Serious and useful, but it needs counsel/retention-law labeling. The hash-mismatch story is legal-technical and should not read like a settled engineering fact. |
| P047 | 136 | Tighten | Good hygiene, but no reopen criterion and no owner. Either mark as threat-model checklist or add the profile/spec surface that will carry it. |
| P048 | 138 | Tighten | Good inventory posture. "Center-adjacent" is vague; decide whether rotation requirements land in center spec, adapter profile, or product runbook. |
| P049 | 142 | OK | Good "emission is not completeness" guard. No issue. |
| P050 | 144 | Split | Dense but valuable. It prioritizes decision provenance and lists four other depth gaps. Split the priority from the backlog list. |
| P051 | 146 | OK | Good use of research as input, not mandate. No issue. |
| P052 | 148 | Conflict | Per-layer tags are a committed lean here, but Part B P081 says "What 1.0 means" is still open. Recast P081 as sales naming fork or downgrade this paragraph. |
| P053 | 150 | Tighten | Strong integration-test need. "Eventually" weakens it; under no-defer greenfield economics this should probably be "before stack conformance claims." |
| P054 | 152 | OK | Good reserved-crypto discipline. No issue. |
| P055 | 154 | Tighten | Good dual-hash framing, but "where accepted" is a red flag in a committed-lean section. Name the acceptance status or move to open forks. |
| P056 | 156 | OK | Strong shadow-event prohibition. No issue. |
| P057 | 158 | Tighten | Good product floor, but legal statute claims need counsel label. "eIDAS-class thinking" is too loose if this may become external. |
| P058 | 164 | OK | True open fork. It does not contradict Part A if P012 remains a lean and this is about future federation rules. Add that qualifier. |
| P059 | 166 | OK | True product/custody fork. No issue. |
| P060 | 168 | Conflict | Part A P015/P016 lean relational plus `ct_merkle`; this says primary store remains open. Reclassify as "fork under relational lean" or make storage truly undecided. |
| P061 | 170 | Conflict | Part A recommends Postgres plus `ct_merkle`; this says wire now versus spike-first is open. This is implementation timing, not architecture fork; move to constraints or plans. |
| P062 | 172 | OK | True open witness fork. No issue. |
| P063 | 174 | Conflict | Conflicts with P019. Keep JWS pressure open as profile/interoperability pressure, not as canonical encoding open work, unless dCBOR is not actually committed. |
| P064 | 176 | OK | Consistent with P020: independence is lean, KMS derivation details open. No issue. |
| P065 | 178 | OK | Consistent with P024. No issue. |
| P066 | 180 | Conflict | Conflicts with P032. Either Part A's Restate lean is weaker than stated, or this is no longer "no default yet." |
| P067 | 182 | OK | Good production-readiness fork. No issue. |
| P068 | 184 | OK | Consistent with P014 if framed as unresolved edge cases under ledger-visible compensation. Add that qualifier. |
| P069 | 186 | OK | True unresolved global policy. No issue. |
| P070 | 188 | OK | True unresolved procurement/admissibility issue. No issue. |
| P071 | 190 | OK | True high-debt fork. No issue. |
| P072 | 192 | OK | True high-debt fork. No issue. |
| P073 | 194 | Conflict | Part A P014 says Trellis append is commit authority. This paragraph should become "remaining terminology cleanup under append-authority lean" unless hard/soft commit is truly undecided. |
| P074 | 196 | OK | Good pin-policy fork. No issue. |
| P075 | 198 | OK | Productization fork, not architecture fork. Fine in Part B if Part B allows product forks. |
| P076 | 200 | OK | True spec-gap paragraph. Strong and concrete. |
| P077 | 202 | OK | True middleware contract fork. No issue. |
| P078 | 204 | OK | True semantic ownership fork. No issue. |
| P079 | 206 | OK | Product fork; fits if Part B is broader than architecture. No issue. |
| P080 | 208 | OK | Good sales-versus-engineering distinction. No issue. |
| P081 | 210 | Conflict | Conflicts with P052's per-layer version lean. Reclassify as "external use of 1.0 label" or downgrade P052. |
| P082 | 212 | OK | Good organizational fork. Define T4 locally or remove the code name. |
| P083 | 214 | OK | Good cleanup fork. No issue. |
| P084 | 216 | OK | Good prioritization fork. No issue. |
| P085 | 218 | OK | Strong meta-ordering fork. "Unified-case-ledger-class" needs glossary entry. |
| P086 | 220 | OK | Good future capability note. No issue. |
| P087 | 222 | Tighten | Useful product gap statement, but "accepted signature-profile workflow slice" is undefined. Add a source/status note. |
| P088 | 224 | OK | Consistent with P039/P041. No issue. |
| P089 | 226 | OK | Good adapter-tier rule. No issue. |
| P090 | 228 | OK | True evidence/product fork. No issue. |
| P091 | 230 | OK | Good data-plane fork. No issue. |
| P092 | 232 | OK | Good policy fork. No issue. |
| P093 | 238 | OK | Good framing. No issue. |
| P094 | 240 | OK | Good hard reopen signal. Add rough SLO examples later if this becomes operational. |
| P095 | 242 | OK | Strong canonicality kill criterion. No issue. |
| P096 | 244 | OK | Good witness-tier kill criterion. No issue. |
| P097 | 246 | OK | Strong engine-shadow-ledger kill criterion. No issue. |
| P098 | 248 | OK | Good migration kill criterion. No issue. |
| P099 | 250 | OK | Good evidence-binding kill criterion. No issue. |
| P100 | 256 | OK | Good bus-factor constraint. No issue. |
| P101 | 258 | Tighten | Useful purchasability distinction, but the example list is long enough to obscure the point. Split evidence packages from product plumbing if this grows. |
| P102 | 260 | OK | Strong operational constraint. No issue. |
| P103 | 262 | OK | Necessary legal/product alignment constraint. No issue. |
| P104 | 264 | Split | Valuable but too compressed. It is a backlog dump across sidecars, schemas, synthesis tooling, WOS, governance, coprocessor, tests, and Studio. Split by domain or move to an appendix. |
| P105 | 266 | OK | Good process-debt note. No issue. |
| P106 | 268 | OK | Strong closing frame. No issue. |

## Highest-Priority Rewrites

These paragraphs should be rewritten before the document is used as an owner decision surface:

1. P007, P010, P012, P041, P050, and P104: split overloaded paragraphs.
2. P019/P063, P032/P066, P052/P081, P060/P061/P015, and P073/P014: resolve status conflicts.
3. P003, P033, P082, P085, and P087: define source labels and code names locally.
4. P046, P057, and P103: label counsel-dependent legal claims.
5. P055: either mark dual-hash as accepted or move it out of committed leans.

## Suggested Status Model

Use this vocabulary to remove drift:

- **Lean:** default implementation and test posture today.
- **Fork under lean:** an unresolved implementation/profile choice that does not unset the current lean.
- **True open fork:** no default exists; implementation should not proceed without a decision or bounded spike.
- **Kill criterion:** hard evidence that forces a lean review.
- **Constraint:** organizational, legal, product, or process condition the architecture must satisfy.
- **Profile:** optional but center-declared variation with vectors and verifier behavior.
- **Adapter:** replaceable implementation behind a center-declared contract.

This preserves the document's intent while preventing Part B from accidentally undoing Part A.
