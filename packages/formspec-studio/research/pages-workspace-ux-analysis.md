# Pages Workspace — UX Implications of Current Flows

## Summary

The resolution layer is **data-driven only**: it returns `mode: 'wizard'` only when there is *already* wizard data (theme pages, definition groups with layout.page, or a Wizard component). It does **not** reflect the user’s explicit choice when they click the mode selector. That creates a catch-22 and makes the banner text misleading.

---

## 1. What Actually Happens When the User Clicks "Wizard"

**User action:** Opens Pages tab (single-page form, no theme pages). Sees banner: *"Single-page form. Enable wizard mode to add pages."* Clicks the **Wizard** mode pill.

**Backend:** `pages.setMode({ mode: 'wizard' })` runs. It sets `formPresentation.pageMode = 'wizard'` and `theme.pages = []` (empty array).

**Resolution:** `resolvePageStructure()` uses:
- `hasThemePages = (theme.pages ?? []).length > 0` → **false**
- Tier 2 (theme) is skipped
- Tier 1: no groups with `layout.page` → inferred pages empty
- Fallback: returns `mode: 'single'`, `controllingTier: 'none'`, `pages: []`

**UI:** Nothing changes. Mode still shows Single, banner unchanged, no "Add Page" or "Generate from Groups". The user’s click has **no visible effect**.

So: the banner tells the user to "enable wizard mode," but enabling it (clicking Wizard) does not change what they see. That’s a **broken affordance**.

---

## 2. The Catch-22

"Add Page" and "Generate from Groups" are shown only when:
- `isMultiPage` is true → `structure.mode !== 'single'`
- `structure.controllingTier !== 'component'`

So they appear only when resolution already returns wizard (or tabs) and theme or definition is controlling. In practice that means:
- **Theme controlling:** at least one entry in `theme.pages`
- **Definition controlling:** at least one group with `layout.page` and `pageMode !== 'single'`

So:
- To see **Add Page**, you must already have at least one theme page (or definition-based inferred pages).
- To get that first theme page from the Pages tab you’d need either Add Page or Generate from Groups — both hidden until you’re already in wizard.

Result: **from a clean single-page form, the Pages tab alone cannot get you into wizard.** You need one of:
- Import a project that already has theme pages or wizard mode + groups
- Add groups with `layout.page` in Data/Structure and then… still need `pageMode: 'wizard'` and resolution to expose wizard (definition tier only applies when `pageMode !== 'single'`)

So even "Generate from Groups" is only visible when you’re already in a state that resolution considers wizard (theme pages exist or definition has layout.page and wizard mode). If you have definition groups with `layout.page` but no theme pages and `pageMode: 'single'`, resolution is still single/none — so you never see "Generate from Groups" to bootstrap theme pages from those groups.

---

## 3. Banner vs Reality

| Banner (controllingTier) | Message | Reality |
|--------------------------|--------|--------|
| `none` | "Single-page form. Enable wizard mode to add pages." | Clicking Wizard does not enable anything visible; user stays in single. |
| `definition` | "Pages inferred from definition groups. Add theme pages for full control." | Makes sense: user can add theme pages (Add Page is visible). |
| `theme` | (no banner) | Normal editing; matches behavior. |
| `component` | "A Wizard component is active… Theme pages are shadowed." | Accurate. |

Only the `none` case is misleading: it suggests an action that does not change the UI.

---

## 4. Intended Model (ADR) vs Resolution

ADR says:
- "Users think 'I want a wizard' — the studio handles the tier plumbing."
- `pages.setMode`: "if 'wizard' + no pages → init empty array."

So the *intent* is that choosing wizard mode is a valid state even with zero theme pages. The resolution layer, however, only returns `mode: 'wizard'` when there is *existing* wizard data (theme pages, inferred pages, or Wizard component). It never treats "pageMode is wizard but theme.pages is empty" as wizard.

So **resolution is data-only and ignores explicit user intent** (the mode pill). That contradicts the ADR and produces the catch-22 and the misleading banner.

---

## 5. Recommended Fix: Honor Mode Intent When Theme Is Empty

**Change:** When there is no Wizard component and no theme pages, **still** allow the *definition’s* `formPresentation.pageMode` to drive the resolved mode for the Pages UI:

- If `pageMode === 'wizard'` (or `'tabs'`) and `!hasThemePages` and no Tier 3 Wizard:
  - Return `mode: 'wizard'` (or `'tabs'`), `pages: []`, `controllingTier: 'theme'`.
- No change to Tier 3 or to the case where theme.pages has length > 0.

**Effects:**
- Clicking **Wizard** immediately shows wizard mode, empty page list, **Add Page**, and **Generate from Groups**.
- No catch-22: user can add the first page or generate from definition groups.
- Banner for `none` only shows when we’re actually in single (no wizard intent). Once they click Wizard, we’re in theme tier with zero pages, so no "enable wizard mode" banner.
- Preview/runtime can still treat "wizard mode + empty theme.pages" as single-page until theme or definition provides pages; that’s a separate concern from the studio’s *editing* UX.

**Edge case:** If we have definition groups with `layout.page` and `pageMode === 'wizard'`, today we’d return definition tier with inferred pages. With the change, when theme.pages is empty we’d return theme tier with empty pages. So we’d *lose* the inferred pages in the UI until the user runs "Generate from Groups" or adds pages. So we need a rule that doesn’t break that path.

**Refined rule:**  
- If **Tier 3** Wizard exists → unchanged (component wins).  
- If **theme.pages.length > 0** → Tier 2 as today (theme wins).  
- If **theme.pages is empty**:
  - If **inferredPages.length > 0** and **pageMode !== 'single'** → Tier 1 as today (definition with inferred pages).
  - Else if **pageMode === 'wizard'** or **pageMode === 'tabs'** → return **mode from pageMode**, **pages: []**, **controllingTier: 'theme'** (so the mode selector and Add Page / Generate from Groups are visible).
  - Else → none/single as today.

That way:
- Clicking Wizard with no data → mode wizard, controllingTier theme, empty pages, Add Page and Generate visible.
- Having groups with layout.page and pageMode wizard still shows inferred pages (Tier 1) until the user adds or generates theme pages; then Tier 2 takes over.

---

## 6. E2E Implications

The current E2E test was changed to use a seed that *already* has theme pages (WIZARD_THEME_SEED), so we never assert "click Wizard → then see Add Page." That hides the broken flow. After fixing resolution:
- We can add a test: import single-page seed, go to Pages, click Wizard, then expect Add Page and Generate from Groups to be visible.
- Existing tests that rely on "wizard with pages" continue to pass.

---

## 7. Summary Table

| Scenario | Current resolution | UX | After fix |
|----------|-------------------|----|-----------|
| Single-page, user clicks Wizard | mode single, none | No visible change; misleading | mode wizard, theme, empty pages; Add Page + Generate visible |
| Single-page, user does nothing | mode single, none | Banner says "enable wizard mode" | Same |
| Wizard + empty theme.pages (after setMode) | mode single, none | Catch-22 | mode wizard, theme; can add or generate |
| Wizard + 1+ theme pages | mode wizard, theme | Works | Unchanged |
| Definition groups with layout.page + pageMode wizard | mode wizard, definition | Inferred pages, Add Page visible | Unchanged |

Implementing the refined rule in `page-resolution.ts` aligns the UX with the ADR and removes the catch-22 and misleading banner for the "enable wizard mode" flow.
