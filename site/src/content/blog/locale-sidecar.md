---
title: "Translating forms without breaking them: the Locale Document"
description: "A federal grant application needs English, Spanish, and French — and a typo fix in the French translation must never re-trigger validation or require a new form version. Formspec's Locale Document separates translation from form logic entirely."
date: 2026-03-24
tags: ["specification", "locale", "deep-dive"]
author: "Michael Deeb & Claude"
---

An annual grant report goes through six months of compliance review. It supports English, Spanish, and French. Midway through the grant cycle, a program analyst catches a mistranslation in the Spanish version — "Financiamiento recibido" should be "Fondos recibidos." The fix takes thirty seconds. But in most form systems, that thirty-second fix means touching the same file that defines which fields are required, how the budget formula works, and when the expenditure section becomes visible. A new form version. Another compliance review. Another change control ticket.

The two common approaches both create this problem:

1. **Embed all translations in the definition.** The translator edits the same file as the form architect. A label fix in Spanish creates a new version of the entire form. Merge conflicts between the structural author and three translation teams. A compliance review of the form definition now also covers translation changes — or it doesn't, and nobody is sure what changed.

2. **The spec says nothing — build your own.** Every contractor reinvents localization differently. The interpolation model conflicts with the form's expression language. The fallback behavior is whatever the developer implemented last Tuesday. There is no standard for the next team to inherit.

Formspec takes a third path: the **Locale Document** — a standalone file that provides translated strings for a form, completely separated from the form's logic and structure.

## Translation cannot break form logic

Formspec processes a form in layers. The core engine handles structure, calculations, validation, and conditional logic. Translation happens in a separate layer *after* all of that is finished — it takes the already-validated, already-calculated form and swaps in the right strings for the user's language.

Changing the active language re-resolves display text. It does not re-run validation. It does not recalculate formulas. It does not change which fields are visible or required.

- **A translation fix cannot introduce a logic regression.** The form definition and locale files go through separate review cycles — different reviewers, different approval gates, different timelines.
- **Switching languages mid-session is safe.** A grantee filling out a report in French switches to English to double-check a field label's meaning, then switches back. Entered data, validation state, and progress are untouched.
- **Locale Documents version independently.** The Spanish translation ships at version 1.3 while the form definition moves to 2.0. The system warns on version mismatch but never crashes — English defaults fill the gaps until the translation catches up.

## What this looks like end to end

The annual grant report, built in English:

```json
{
  "title": "Annual Grant Report",
  "items": [
    { "key": "projectName", "type": "field", "label": "Project name",
      "hint": "Enter the official name as it appears in the notice of award" },
    { "key": "fundingStatus", "type": "field", "label": "Funding received?",
      "choices": [
        { "value": "yes", "label": "Yes" },
        { "value": "no", "label": "No" }
      ] },
    { "key": "piEmail", "type": "field", "label": "PI email" }
  ]
}
```

The Spanish Locale Document — a separate file, maintained by a separate team:

```json
{
  "$formspecLocale": "1.0",
  "version": "1.0.0",
  "locale": "es",
  "targetDefinition": {
    "url": "https://agency.gov/forms/grant-report",
    "compatibleVersions": ">=1.0.0 <3.0.0"
  },
  "strings": {
    "$form.title": "Informe anual de subvenciones",
    "projectName.label": "Nombre del proyecto",
    "projectName.hint": "Ingrese el nombre oficial tal como aparece en el aviso de adjudicación",
    "fundingStatus.label": "¿Fondos recibidos?",
    "fundingStatus.options.yes.label": "Sí",
    "fundingStatus.options.no.label": "No",
    "piEmail.label": "Correo electrónico del IP",
    "piEmail.errors.REQUIRED": "El correo electrónico del investigador principal es obligatorio"
  }
}
```

The French-Canadian locale — overrides only what differs from standard French:

```json
{
  "$formspecLocale": "1.0",
  "version": "1.0.0",
  "locale": "fr-CA",
  "fallback": "fr",
  "targetDefinition": {
    "url": "https://agency.gov/forms/grant-report",
    "compatibleVersions": ">=1.0.0 <3.0.0"
  },
  "strings": {
    "projectName.hint": "Entrez le nom officiel tel qu'il apparaît dans l'entente"
  }
}
```

One string. The `entente` / `accord` distinction matters in Canadian French legal context. Everything else — labels, option text, error messages — falls through to the `fr` base locale. If that's also missing a key, the English text from the definition fills in.

What a grantee sees:

| | English (default) | Spanish | French-Canadian |
|---|---|---|---|
| Form title | Annual Grant Report | Informe anual de subvenciones | Rapport annuel sur les subventions |
| Project name hint | ...as it appears in the notice of award | ...tal como aparece en el aviso de adjudicación | ...tel qu'il apparaît dans l'**entente** |
| "Required" error | PI email is required | El correo electrónico del investigador principal es obligatorio | L'adresse courriel du chercheur principal est obligatoire |

Three files. Three teams. Three release cycles. The form definition — the file that went through six months of compliance review — never changed.

## Separate artifacts, separate reviews

The form architect builds the definition — structure, logic, validation rules, English defaults. That's the artifact that goes through compliance review. A translator works in a separate file with nothing but labels, hints, and error messages in their language. They never see a validation rule. The form architect never coordinates with them.

Locale Documents are JSON — structured, diffable, version-controllable. `git blame` shows who changed which string. An accessibility review of the Spanish locale is a review of a flat list of strings, not a form definition with embedded logic.

## Different text for different contexts

A budget section displays "Budget" on screen. The screen reader announces "Annual budget details section." The generated SF-425 PDF needs "Section III: Detailed Budget Information." Three contexts, one field, and each one needs to be translated.

Locale Documents handle this with context suffixes:

```json
{
  "budgetSection.label": "Section budgétaire",
  "budgetSection.label@short": "Budget",
  "budgetSection.label@pdf": "Section III : Informations budgétaires détaillées",
  "budgetSection.label@accessibility": "Section du budget annuel détaillé"
}
```

One field, four presentations, all translated. The `@accessibility` context carries purpose-written screen-reader text — not the visible label run through Google Translate, but text a translator wrote specifically for assistive technology, in French. The `@pdf` context carries the formal label for the SF-425.

This works on any localizable property: `hint@accessibility` provides a screen-reader-specific hint, `description@pdf` provides expanded text for print output.

## The fallback cascade

When the system resolves a string, it walks four steps from most-specific to least-specific:

| Step | Source | Example for `fr-CA` |
|------|--------|-------------------|
| 1 | Regional Locale Document | Look in the `fr-CA` file |
| 2 | Explicit fallback | `fr-CA` declares `fallback: "fr"` — look in the `fr` file |
| 3 | Implicit language fallback | Strip the region: look in `fr` (skipped if step 2 already checked it) |
| 4 | Inline default | Use the English text from the Definition |

The Canadian French translator writes only the strings that differ regionally. The base French translator provides the bulk. The form definition provides the English safety net. Every string resolves to *something* — the form never shows a blank label.

| Key | fr-CA file | fr file | Definition | Resolved for fr-CA |
|-----|-----------|---------|------------|-------------------|
| `projectName.label` | -- | "Nom du projet" | "Project name" | **"Nom du projet"** |
| `projectName.hint` | "...dans l'entente" | "...dans l'accord" | "Enter the official name..." | **"...dans l'entente"** |

This is the same pattern that iOS, Android, and ICU resource bundles use for regional locale overrides — applied to form definitions.

## Dynamic strings

A budget table has twelve line items. The label "Line item 3" requires knowing which row the grantee is on. "Budget remaining: $45,000" requires knowing the current calculated total. Static text replacement can't handle this.

Locale strings can embed live expressions using `{{...}}` delimiters. These use [FEL](/blog/fel-design) (Formspec Expression Language) — the same language that powers validation rules and calculated fields elsewhere in the form:

```json
{
  "lineItems.label": "Poste budgétaire {{@index}}",
  "budgetRemaining.hint": "Il vous reste {{formatNumber($remaining)}} $"
}
```

`{{@index}}` inserts the current line item number. `{{formatNumber($remaining)}}` inserts the remaining budget formatted for the user's locale — commas and decimal points in the right places for French.

There is one expression language across the entire system. The same `$remaining` reference in a validation rule is the same reference in a localized hint. No parallel systems to wire together, no `{0}` placeholders that a developer must map to the right variable.

For pluralization, the core `pluralCategory()` function returns the CLDR plural category (`one`, `two`, `few`, `many`, `other`) for any number in any language. Authors combine it with `if()` to select the right word form:

```json
{
  "totalItems.label": "{{$count}} {{if(pluralCategory($count) = 'one', 'article', 'articles')}}"
}
```

Because `pluralCategory()` uses CLDR data, this works correctly for all languages — including those with more than two plural forms (Arabic has six, Polish has three). Authors simply chain additional conditions.

## Version compatibility

Each Locale Document declares which form versions it was written for:

```json
{
  "targetDefinition": {
    "url": "https://agency.gov/forms/grant-report",
    "compatibleVersions": ">=1.0.0 <3.0.0"
  }
}
```

"This translation covers the grant report form, versions 1.x and 2.x." When the definition ships version 3.0 — fields renamed, the expenditure section restructured — the system warns that the locale file may be stale. It does not crash. Grantees see English defaults for strings the locale file no longer covers, and the operations team knows to commission updated translations.

The form ships when the form is ready. Translations catch up on their own schedule. A linter compares the locale file's keys against the current definition and reports: "12 new fields have no Spanish translation. 3 keys reference fields that no longer exist." That runs in CI before deployment — not as a surprise in production.

## What the spec handles and what it doesn't

| Concern | Where it lives |
|---------|---------------|
| Which strings to show in which language | Locale Document |
| Language switcher, `Accept-Language` negotiation | Host application |
| Right-to-left layout (Arabic, Hebrew) | Theme Document |
| Number and date formatting (`1,234.56` vs `1.234,56`) | Platform APIs (`Intl.NumberFormat`) |
| Translation workflow, review gates, approval | Organization process + TMS tools |

The Locale Document maps form strings to their translations. That's its entire scope. Layout direction, number formatting, and translation workflow are real concerns — they live in other layers.

## Known limitations

**Pluralization verbosity.** `pluralCategory()` returns the correct CLDR plural category for any language, but authors must wire it to the right word form using `if()` chains. For two-form languages (English, French, Spanish), this is concise: `if(pluralCategory($count) = 'one', 'item', 'items')`. For languages with three or more forms (Polish, Arabic, Russian, Welsh), the `if()` chains get longer. The industry standard (ICU MessageFormat) has a dedicated `{count, plural, ...}` syntax that’s more compact for this case. We chose one expression language and accepted the verbosity for complex-plural languages.

**Translation tooling integration.** The flat JSON format imports into Crowdin, Lokalise, and Phrase, but those tools don't natively understand the `{{...}}` expression delimiters or the `@context` suffix convention. Without custom configuration, a translator's editing environment may expose expressions as editable text. Production deployments should configure their TMS to protect `{{...}}` blocks and set up validation that checks expressions survive the round-trip intact. The spec defines the format; the TMS integration requires tooling work.

**No character-length constraints.** The spec doesn't define maximum string lengths. A German translation that's 40% longer than the English original may break a mobile layout. Character limits are a rendering concern, not a translation-format concern, but the gap means layout breakage from long translations is caught at QA time, not at translation time.

**Silent fallback in production.** The cascade is designed to be resilient — a missing translation shows the English default, never a blank field. That resilience can mask gaps. A form that looks fine in English may have dozens of untranslated strings visible to Spanish-speaking grantees, with no error in the logs — only warnings. Production deployments need a locale health check in CI: coverage percentage per locale, missing strings, stale keys. Without that gate, mixed-language forms slip through.

**Cross-tier dependencies.** A locale file can translate Theme page titles (`$page.review.title`) and Component button labels (`$component.submitBtn.label`), not just Definition field labels. This means one locale file may depend on three artifacts — Definition, Theme, and Component Document — being in sync. Orphaned keys (referencing a page that was removed) produce warnings, not errors. Forward-compatible, but it requires discipline to keep locale files in sync when the Theme or Component Document changes.

---

That annual grant report? Three JSON files — one English definition, one Spanish locale, one French-Canadian locale that overrides a single regional term. The program analyst who caught "Financiamiento recibido" opens a pull request against the Spanish locale file, it gets reviewed, and it ships. The form definition — the file that went through six months of compliance review — is untouched. No new version. No change control ticket. No re-triggered validation.

The locale specification is a companion to the [core spec](/docs/specs/core), following the same sidecar pattern that [Theme](/docs/specs/theme) and [Component](/docs/specs/component) Documents established. The full specification is at `specs/locale/locale-spec.md`.
