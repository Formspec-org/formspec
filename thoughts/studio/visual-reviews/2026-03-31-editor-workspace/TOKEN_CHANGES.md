# Token & CSS Changes Reference

Quick lookup table for all visual changes. Use this when implementing to avoid missing a value.

---

## ItemRow.tsx — Selected State (Problem 3)

**Current:**
```css
border-accent/30
bg-accent/[0.05]
shadow-[0_14px_34px_rgba(59,130,246,0.12)]
```

**New:**
```css
border-accent/50
bg-accent/[0.09]
shadow-[0_8px_24px_rgba(59,130,246,0.18)]
```

**Why:**
- `border-accent/50` — border is now 50% opacity (was 30%), making it confidently blue
- `bg-accent/[0.09]` — background is 9% opacity (was 5%), more perceptible at distance
- `shadow-[0_8px_24px_...]` — shadow is tighter (8px blur, was 14px) but higher opacity (0.18, was 0.12), reading as more solid at distance

---

## DefinitionTreeEditor.tsx — Master Card Shadow (Problem 5)

**Current:**
```css
shadow-[0_24px_70px_rgba(30,24,16,0.08)]
```

**New:**
```css
shadow-[0_4px_16px_rgba(30,24,16,0.04)]
```

**Why:**
- Reduces visual weight and prominence
- Aligns with subtle interface hierarchy
- Matches the refined token system (tight, close shadows preferred)

---

## ItemRowContent.tsx — Field Label/Key Hierarchy (Problem 2)

### Label (Primary)

**Current:**
```jsx
<div className='text-[14px] font-normal leading-snug tracking-normal text-ink/72'>
  {labelForDescription ?? 'Add a display label…'}
</div>
```

**New:**
```jsx
<div className='text-[16px] font-semibold leading-6 text-ink'>
  {labelForDescription ?? 'Add a display label…'}
</div>
```

**Changes:**
- Size: 14px → 16px
- Weight: `font-normal` → `font-semibold`
- Color: `text-ink/72` → `text-ink`

---

### Key (Secondary)

**Current:**
```jsx
<span className='font-mono text-[17px] font-semibold ... text-ink'>
  {itemKey}
</span>
```

**New:**
```jsx
<span className='font-mono text-[12px] font-medium tracking-[0.08em] text-ink/60'>
  {itemKey}
</span>
```

**Changes:**
- Size: 17px → 12px
- Weight: `font-semibold` → `font-medium`
- Color: `text-ink` → `text-ink/60`

---

## ItemRowContent.tsx — Empty Category Affordance (Problem 4)

**Current:**
```jsx
<dd className={`... text-[14px] font-medium ... text-ink/94 ${isExpanded ? 'bg-accent/12 ring-1 ring-accent/25' : ''}`}>
  <span className='truncate'>{value}</span>
</dd>
```

**New:**
```jsx
<dd className={`... text-[14px] font-medium transition-colors ${
  isExpanded ? 'bg-accent/12 ring-1 ring-accent/25 text-ink/90' : ''
} ${
  selected && value === '—'
    ? 'text-accent/40 italic hover:text-accent/60 hover:ring-1 hover:ring-inset hover:ring-accent/15 cursor-pointer'
    : 'text-ink/94'
}`}>
  <span className='truncate'>
    {selected && value === '—' ? (
      <>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="inline mr-1 align-text-bottom">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8M8 12h8" />
        </svg>
        Add…
      </>
    ) : (
      value
    )}
  </span>
</dd>
```

**Changes:**
- When `selected && value === '—'`:
  - Render plus icon + "Add…" text
  - Color: `text-accent/40` (dimmed blue)
  - Hover: `text-accent/60` (brighter) + `ring-1 ring-accent/15` (subtle ring)
  - Cursor: `cursor-pointer`
- When not selected or value is set: unchanged

---

## Shell.tsx — Warm Gradient Extension (Problem 7)

**Current:**
```jsx
className={`h-full flex flex-col ${activeTab === 'Editor' && activeEditorView === 'build' ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)] dark:bg-none' : ''}`}
```

**New:**
```jsx
className={`h-full flex flex-col ${activeTab === 'Editor' ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)] dark:bg-none' : ''}`}
```

**Changes:**
- Condition: `activeTab === 'Editor' && activeEditorView === 'build'` → `activeTab === 'Editor'`
- Gradient now applies to both Build and Manage views

---

## Shell.tsx — Remove Sticky Toggle Bar (Problem 1)

**Current** (lines 137–148):
```jsx
if (activeTab === 'Editor') {
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-20 border-b border-border/70 bg-bg-default/80 backdrop-blur-md px-6 py-3">
        <BuildManageToggle activeView={activeEditorView} onViewChange={setActiveEditorView} manageCount={manageCount} />
      </div>
      <div key={activeEditorView} className="flex-1 overflow-y-auto animate-in fade-in duration-150">
        {activeEditorView === 'build' ? <DefinitionTreeEditor /> : <ManageView />}
      </div>
    </div>
  );
}
```

**New:**
```jsx
if (activeTab === 'Editor') {
  return (
    <div key={activeEditorView} className="flex-1 overflow-y-auto animate-in fade-in duration-150">
      {activeEditorView === 'build' ? <DefinitionTreeEditor /> : <ManageView />}
    </div>
  );
}
```

**Changes:**
- Remove entire sticky wrapper div
- Pass `activeEditorView`, `setActiveEditorView`, `manageCount` to DefinitionTreeEditor as props

---

## DefinitionTreeEditor.tsx — Toggle in Header (Problem 1)

**Current** (around line 380):
```jsx
<div className="flex w-full max-w-[980px] flex-col gap-4 rounded-[22px] border border-border/65 bg-surface/96 px-4 py-4 shadow-[0_24px_70px_rgba(30,24,16,0.08)] backdrop-blur sm:px-5 md:px-6 md:py-5">
  <div className="flex items-start gap-3">
    {/* Existing content starts here */}
```

**New:**
```jsx
<div className="flex w-full max-w-[980px] flex-col gap-4 rounded-[22px] border border-border/65 bg-surface/96 px-4 py-4 shadow-[0_4px_16px_rgba(30,24,16,0.04)] backdrop-blur sm:px-5 md:px-6 md:py-5">
  {/* Add header with toggle */}
  <div className="flex items-center justify-between gap-4">
    <h1 className="text-[18px] font-semibold text-ink">Build</h1>
    <BuildManageToggle activeView={activeEditorView} onViewChange={onViewChange} manageCount={manageCount} />
  </div>

  <div className="flex items-start gap-3">
    {/* Existing content continues */}
```

**Changes:**
- Add header div with toggle
- Reduce shadow from `shadow-[0_24px_70px_...]` to `shadow-[0_4px_16px_...]`
- Accept `activeEditorView`, `onViewChange`, `manageCount` as props

---

## FormHealthPanel.tsx — Already Compliant (Problem 6)

**Current** (line 73):
```jsx
className="w-full text-left rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-2.5 transition-colors hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
```

**Status:** No changes needed. Already using amber (warm, cautionary) instead of red.

---

## Summary Table

| Component | Property | Current | New | File |
|-----------|----------|---------|-----|------|
| Selected card | border | `accent/30` | `accent/50` | ItemRow.tsx |
| Selected card | background | `accent/[0.05]` | `accent/[0.09]` | ItemRow.tsx |
| Selected card | shadow | `0_14px_34px_rgba(...0.12)` | `0_8px_24px_rgba(...0.18)` | ItemRow.tsx |
| Field label | size | 14px | 16px | ItemRowContent.tsx |
| Field label | weight | normal | semibold | ItemRowContent.tsx |
| Field label | color | `ink/72` | `ink` | ItemRowContent.tsx |
| Field key | size | 17px | 12px | ItemRowContent.tsx |
| Field key | weight | semibold | medium | ItemRowContent.tsx |
| Field key | color | `ink` | `ink/60` | ItemRowContent.tsx |
| Empty category | color (selected) | N/A | `accent/40` | ItemRowContent.tsx |
| Empty category | text (selected) | N/A | "Add…" + icon | ItemRowContent.tsx |
| Master card | shadow | `0_24px_70px_rgba(...0.08)` | `0_4px_16px_rgba(...0.04)` | DefinitionTreeEditor.tsx |
| Editor workspace | gradient | Build only | Build + Manage | Shell.tsx |
| Sticky toggle | display | visible | removed | Shell.tsx |
