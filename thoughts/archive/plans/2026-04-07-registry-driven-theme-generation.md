# Registry-Driven Theme Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `token-registry.json` the single source of truth for token defaults — generate `default-theme.json` tokens and CSS fallback values from it, move platform selectors/defaults into renderer code.

**Architecture:** A build script reads the registry and generates: (1) the `tokens` section of `default-theme.json`, (2) CSS fallback values in `default.tokens.css`. Platform rendering behavior (selectors, labelPosition defaults, a11y defaults) moves from the theme document into a `platform-defaults.ts` module. The renderers merge platform defaults with user-provided themes at cascade Level -2.

**Tech Stack:** Node.js build script, TypeScript, CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/generate-theme-from-registry.mjs` | Create | Build script: reads registry, generates theme tokens + CSS fallbacks |
| `packages/formspec-layout/src/platform-defaults.ts` | Create | Platform selectors, defaults, and `buildPlatformTheme()` |
| `packages/formspec-layout/src/default-theme.json` | Modify (generated) | Tokens section becomes generated; selectors/defaults removed |
| `packages/formspec-layout/src/styles/default.tokens.css` | Modify (generated fallbacks) | CSS fallback hex values patched by build script |
| `packages/formspec-layout/src/index.ts` | Modify | Export `platformDefaults`, `platformSelectors`, `buildPlatformTheme` |
| `packages/formspec-react/src/renderer.tsx` | Modify | Use `buildPlatformTheme()` instead of `defaultThemeJson` |
| `packages/formspec-react/src/index.ts` | Modify | Re-export `defaultTheme` from `buildPlatformTheme()` |
| `packages/formspec-webcomponent/src/element.ts` | Modify | Use `buildPlatformTheme()` instead of `defaultThemeJson` |
| `packages/formspec-webcomponent/src/index.ts` | Modify | Re-export `defaultTheme` from `buildPlatformTheme()` |
| `packages/formspec-studio-core/src/preview-documents.ts` | Modify | Use `buildPlatformTheme()` instead of `defaultThemeJson` |
| `packages/formspec-layout/tests/theme-generation.test.ts` | Create | Tests for `buildPlatformTheme()` and registry-theme alignment |
| `packages/formspec-layout/package.json` | Modify | Add `generate` script |

---

### Task 1: Create `platform-defaults.ts` with platform rendering behavior

**Files:**
- Create: `packages/formspec-layout/src/platform-defaults.ts`
- Modify: `packages/formspec-layout/src/index.ts`
- Test: `packages/formspec-layout/tests/theme-generation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/formspec-layout/tests/theme-generation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { platformDefaults, platformSelectors, buildPlatformTheme } from '../src/index';

describe('platformDefaults', () => {
    it('sets labelPosition to top', () => {
        expect(platformDefaults.labelPosition).toBe('top');
    });

    it('sets liveRegion to off', () => {
        expect(platformDefaults.accessibility?.liveRegion).toBe('off');
    });
});

describe('platformSelectors', () => {
    it('assigns formspec-themed-group class to groups', () => {
        const groupSelector = platformSelectors.find(s => s.match.type === 'group');
        expect(groupSelector?.apply.cssClass).toBe('formspec-themed-group');
    });

    it('assigns role group to groups', () => {
        const groupSelector = platformSelectors.find(s => s.match.type === 'group');
        expect(groupSelector?.apply.accessibility?.role).toBe('group');
    });

    it('sets labelPosition start for booleans', () => {
        const boolSelector = platformSelectors.find(s => s.match.dataType === 'boolean');
        expect(boolSelector?.apply.labelPosition).toBe('start');
    });

    it('has exactly 4 selectors', () => {
        expect(platformSelectors).toHaveLength(4);
    });
});

describe('buildPlatformTheme', () => {
    it('produces a valid ThemeDocument shape', () => {
        const theme = buildPlatformTheme();
        expect(theme.$formspecTheme).toBe('1.0');
        expect(theme.version).toBeDefined();
        expect(theme.targetDefinition).toBeDefined();
        expect(theme.tokens).toBeDefined();
        expect(theme.defaults).toBeDefined();
        expect(theme.selectors).toBeDefined();
    });

    it('includes all registry token defaults', () => {
        const theme = buildPlatformTheme();
        expect(theme.tokens['color.primary']).toBe('#27594f');
        expect(theme.tokens['color.dark.primary']).toBe('#8bb8ac');
        expect(theme.tokens['spacing.md']).toBe('1rem');
        expect(theme.tokens['font.family']).toContain('Instrument Sans');
    });

    it('includes platform selectors', () => {
        const theme = buildPlatformTheme();
        expect(theme.selectors).toHaveLength(4);
    });

    it('includes platform defaults', () => {
        const theme = buildPlatformTheme();
        expect(theme.defaults.labelPosition).toBe('top');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-layout && npx vitest run tests/theme-generation.test.ts`
Expected: FAIL — `platformDefaults` not exported

- [ ] **Step 3: Create `platform-defaults.ts`**

Create `packages/formspec-layout/src/platform-defaults.ts`:

```ts
/** @filedesc Platform rendering defaults — cascade Level -2 behavior. */
import type { PresentationBlock, ThemeSelector } from './theme-resolver.js';
import registryDoc from './token-registry.json' with { type: 'json' };

/** Platform default presentation applied at cascade Level -2. */
export const platformDefaults: PresentationBlock = {
    labelPosition: 'top',
    accessibility: { liveRegion: 'off' },
};

/** Platform selectors applied at cascade Level -2 (below theme selectors). */
export const platformSelectors: ThemeSelector[] = [
    {
        match: { type: 'group' },
        apply: {
            cssClass: 'formspec-themed-group',
            accessibility: { role: 'group' },
        },
    },
    {
        match: { type: 'display' },
        apply: { cssClass: 'formspec-themed-display' },
    },
    {
        match: { type: 'field' },
        apply: { cssClass: 'formspec-themed-field' },
    },
    {
        match: { dataType: 'boolean' },
        apply: { labelPosition: 'start' },
    },
];

/**
 * Extract the flat token map from the embedded token registry.
 * Includes both light-mode defaults and dark-mode defaults (derived via darkPrefix).
 */
function buildTokensFromRegistry(): Record<string, string | number> {
    const tokens: Record<string, string | number> = {};
    const categories = (registryDoc as Record<string, unknown>).categories as
        Record<string, { darkPrefix?: string; tokens: Record<string, { default?: string | number; dark?: string | number }> }> | undefined;
    if (!categories) return tokens;

    for (const [catKey, category] of Object.entries(categories)) {
        for (const [tokenKey, entry] of Object.entries(category.tokens)) {
            if (entry.default !== undefined) {
                tokens[tokenKey] = entry.default;
            }
            if (category.darkPrefix && entry.dark !== undefined) {
                const suffix = tokenKey.startsWith(catKey + '.') ? tokenKey.slice(catKey.length + 1) : tokenKey;
                tokens[`${category.darkPrefix}.${suffix}`] = entry.dark;
            }
        }
    }

    return tokens;
}

/**
 * Build the complete platform theme document from registry defaults and
 * platform rendering behavior. Replaces the hand-maintained default-theme.json.
 */
export function buildPlatformTheme(): {
    $formspecTheme: string;
    version: string;
    name: string;
    title: string;
    description: string;
    targetDefinition: { url: string; compatibleVersions: string };
    tokens: Record<string, string | number>;
    defaults: PresentationBlock;
    selectors: ThemeSelector[];
} {
    return {
        $formspecTheme: '1.0',
        version: '1.0.0',
        name: 'formspec-default',
        title: 'Formspec Default Theme',
        description: 'Platform default theme generated from the token registry.',
        targetDefinition: {
            url: 'urn:formspec:any',
            compatibleVersions: '>=1.0.0',
        },
        tokens: buildTokensFromRegistry(),
        defaults: platformDefaults,
        selectors: platformSelectors,
    };
}
```

Note: If `with { type: 'json' }` import assertion doesn't work, use the same import style as `renderer.tsx` line 3 (`import registryDoc from './token-registry.json'`). Check `tsconfig.json` for `resolveJsonModule`.

- [ ] **Step 4: Export from index.ts**

In `packages/formspec-layout/src/index.ts`, add:

```ts
export { platformDefaults, platformSelectors, buildPlatformTheme } from './platform-defaults.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/formspec-layout && npx vitest run tests/theme-generation.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-layout/src/platform-defaults.ts packages/formspec-layout/src/index.ts packages/formspec-layout/tests/theme-generation.test.ts
git commit -m "feat(layout): add platform-defaults.ts and buildPlatformTheme()"
```

---

### Task 2: Create the generation script

**Files:**
- Create: `scripts/generate-theme-from-registry.mjs`
- Modify: `packages/formspec-layout/package.json`

- [ ] **Step 1: Create `scripts/generate-theme-from-registry.mjs`**

```js
#!/usr/bin/env node
/**
 * Generates default-theme.json tokens and CSS fallback values from the
 * token registry (single source of truth). Run via `npm run generate:theme`.
 *
 * Reads:  schemas/token-registry.json
 * Writes: packages/formspec-layout/src/default-theme.json (tokens only)
 * Patches: packages/formspec-layout/src/styles/default.tokens.css (fallback hex values)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const registry = JSON.parse(
    readFileSync(resolve(root, 'schemas/token-registry.json'), 'utf-8'),
);

// ── 1. Generate default-theme.json tokens ───────────────────────────

const tokens = {};
for (const [catKey, category] of Object.entries(registry.categories)) {
    for (const [tokenKey, entry] of Object.entries(category.tokens)) {
        if (entry.default !== undefined) tokens[tokenKey] = entry.default;
        if (category.darkPrefix && entry.dark !== undefined) {
            const suffix = tokenKey.slice(catKey.length + 1);
            tokens[`${category.darkPrefix}.${suffix}`] = entry.dark;
        }
    }
}

const themePath = resolve(root, 'packages/formspec-layout/src/default-theme.json');
const existingTheme = JSON.parse(readFileSync(themePath, 'utf-8'));

const updatedTheme = {
    ...existingTheme,
    tokens,
};
// Remove selectors and defaults — those are now in platform-defaults.ts
delete updatedTheme.defaults;
delete updatedTheme.selectors;

writeFileSync(themePath, JSON.stringify(updatedTheme, null, 2) + '\n');
console.log(`Updated ${themePath} (${Object.keys(tokens).length} tokens)`);

// ── 2. Patch CSS fallback values ────────────────────────────────────

const cssPath = resolve(root, 'packages/formspec-layout/src/styles/default.tokens.css');
let css = readFileSync(cssPath, 'utf-8');

// Build a map of CSS custom property name → fallback value from registry
// e.g., --formspec-color-primary → #27594f
const cssVarFallbacks = {};
for (const [key, value] of Object.entries(tokens)) {
    if (typeof value === 'string') {
        const cssVar = `--formspec-${key.replace(/\./g, '-')}`;
        cssVarFallbacks[cssVar] = value;
    }
}

// Patch: var(--formspec-color-primary, #OLD) → var(--formspec-color-primary, #NEW)
let patchCount = 0;
for (const [cssVar, fallback] of Object.entries(cssVarFallbacks)) {
    // Match var(--formspec-X, <old-fallback>) and replace the fallback
    const escaped = cssVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
        `(var\\(${escaped},\\s*)([^)]+)(\\))`,
        'g',
    );
    const newCss = css.replace(pattern, (match, prefix, oldFallback, suffix) => {
        // Only replace if the fallback is a simple value (not a nested var or color-mix)
        const trimmed = oldFallback.trim();
        if (trimmed.startsWith('var(') || trimmed.startsWith('color-mix(')) return match;
        patchCount++;
        return `${prefix}${fallback}${suffix}`;
    });
    css = newCss;
}

writeFileSync(cssPath, css);
console.log(`Patched ${patchCount} CSS fallback values in ${cssPath}`);

// ── 3. Sync lint crate copy ─────────────────────────────────────────

const lintRegistryPath = resolve(root, 'crates/formspec-lint/schemas/token-registry.json');
writeFileSync(lintRegistryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`Synced ${lintRegistryPath}`);

// ── 4. Sync layout package copy ─────────────────────────────────────

const layoutRegistryPath = resolve(root, 'packages/formspec-layout/src/token-registry.json');
writeFileSync(layoutRegistryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`Synced ${layoutRegistryPath}`);
```

- [ ] **Step 2: Add npm script**

In `packages/formspec-layout/package.json`, the generation script is project-root level. Add to root `package.json`:

```json
"generate:theme": "node scripts/generate-theme-from-registry.mjs"
```

Also wire it into `docs:generate` so it runs alongside spec artifact generation.

- [ ] **Step 3: Run it and verify output**

Run: `node scripts/generate-theme-from-registry.mjs`
Expected: Updates default-theme.json (tokens only, no selectors/defaults), patches CSS fallbacks, syncs lint crate copy.

Verify: `cat packages/formspec-layout/src/default-theme.json | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'selectors' not in d; assert 'defaults' not in d; assert 'color.primary' in d['tokens']; print('OK')" `

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-theme-from-registry.mjs package.json
git commit -m "build: add registry-to-theme generation script"
```

---

### Task 3: Update React renderer to use `buildPlatformTheme()`

**Files:**
- Modify: `packages/formspec-react/src/renderer.tsx:3,28`
- Modify: `packages/formspec-react/src/index.ts:61-62`
- Test: `packages/formspec-react/tests/renderer.test.tsx`

- [ ] **Step 1: Update renderer.tsx**

Replace the import and usage:

```ts
// BEFORE (line 3)
import defaultThemeJson from '@formspec-org/layout/default-theme';
// AFTER
import { buildPlatformTheme } from '@formspec-org/layout';

// Add a module-level singleton (line ~12, before syncSystemAppearanceClass)
const defaultThemeJson = buildPlatformTheme();
```

The rest of the file (line 28: `const effectiveTheme = themeDocument ?? defaultThemeJson;`) works unchanged because `defaultThemeJson` is still the same variable name.

- [ ] **Step 2: Update index.ts public export**

```ts
// BEFORE (lines 61-62)
import defaultThemeData from '@formspec-org/layout/default-theme';
export const defaultTheme = defaultThemeData;

// AFTER
import { buildPlatformTheme } from '@formspec-org/layout';
export const defaultTheme = buildPlatformTheme();
```

- [ ] **Step 3: Update test references**

In `packages/formspec-react/tests/renderer.test.tsx`, find the import of `defaultThemeJson` and update:

```ts
// BEFORE
import defaultThemeJson from '@formspec-org/layout/default-theme';
// AFTER
import { buildPlatformTheme } from '@formspec-org/layout';
const defaultThemeJson = buildPlatformTheme();
```

- [ ] **Step 4: Run tests**

Run: `cd packages/formspec-react && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-react/src/renderer.tsx packages/formspec-react/src/index.ts packages/formspec-react/tests/
git commit -m "refactor(react): use buildPlatformTheme() instead of default-theme.json"
```

---

### Task 4: Update webcomponent to use `buildPlatformTheme()`

**Files:**
- Modify: `packages/formspec-webcomponent/src/element.ts:22,565`
- Modify: `packages/formspec-webcomponent/src/index.ts:38-39`

- [ ] **Step 1: Update element.ts**

```ts
// BEFORE (line 22)
import defaultThemeJson from '@formspec-org/layout/default-theme';
// AFTER
import { buildPlatformTheme } from '@formspec-org/layout';
const defaultThemeJson = buildPlatformTheme();
```

Line 565 (`return this._themeDocument || defaultThemeJson as ThemeDocument;`) works unchanged.

- [ ] **Step 2: Update index.ts public export**

```ts
// BEFORE (lines 38-39)
import defaultThemeJson from '@formspec-org/layout/default-theme';
export { defaultThemeJson as defaultTheme };
// AFTER
import { buildPlatformTheme } from '@formspec-org/layout';
export const defaultTheme = buildPlatformTheme();
```

- [ ] **Step 3: Run tests**

Run: `cd packages/formspec-webcomponent && npx vitest run` (if tests exist)

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-webcomponent/src/element.ts packages/formspec-webcomponent/src/index.ts
git commit -m "refactor(webcomponent): use buildPlatformTheme() instead of default-theme.json"
```

---

### Task 5: Update studio-core `preview-documents.ts`

**Files:**
- Modify: `packages/formspec-studio-core/src/preview-documents.ts:2,86-122`

- [ ] **Step 1: Update import and normalizeThemeDoc**

```ts
// BEFORE (line 2 area)
import defaultThemeJson from '@formspec-org/layout/default-theme';
// AFTER
import { buildPlatformTheme } from '@formspec-org/layout';
const defaultThemeJson = buildPlatformTheme();
```

The `normalizeThemeDoc` function (lines 86-122) works unchanged — it spreads `defaultThemeJson` as a fallback base, which still has `tokens`, `defaults`, and `selectors` from `buildPlatformTheme()`.

- [ ] **Step 2: Run tests**

Run: `cd packages/formspec-studio-core && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/formspec-studio-core/src/preview-documents.ts
git commit -m "refactor(studio-core): use buildPlatformTheme() instead of default-theme.json"
```

---

### Task 6: Strip `default-theme.json` to tokens-only and remove build aliases

**Files:**
- Modify: `packages/formspec-layout/src/default-theme.json`
- Modify: 8 vite/vitest config files (remove `@formspec-org/layout/default-theme` aliases)
- Modify: `packages/formspec-layout/package.json` (keep export for backwards compat but it's now tokens-only)

- [ ] **Step 1: Run the generation script to strip selectors/defaults**

Run: `node scripts/generate-theme-from-registry.mjs`

Verify `default-theme.json` has `$formspecTheme`, `version`, `name`, `title`, `description`, `targetDefinition`, `tokens` — no `selectors` or `defaults`.

- [ ] **Step 2: Remove build aliases that are no longer needed**

Search all vite/vitest config files for `@formspec-org/layout/default-theme` aliases. These exist because the JSON import needed resolution help. Now that renderers import `buildPlatformTheme` from the main entry point (`@formspec-org/layout`), the JSON aliases may be unnecessary. Check each config:

- `.storybook/main.ts`
- `vitest.config.storybook.ts`
- `packages/formspec-studio-core/vitest.config.ts`
- `packages/formspec-studio/vite.config.ts`
- `packages/formspec-studio/vite.config.lib.ts`
- `packages/formspec-studio/vitest.config.ts`
- `examples/react-demo/vite.config.ts`
- `examples/uswds-grant/vite.config.js`

For each: if no code in that package still imports `@formspec-org/layout/default-theme`, remove the alias. If the token-registry alias is still needed, keep only that one.

- [ ] **Step 3: Keep the package export for backwards compatibility**

The `"./default-theme"` export in `packages/formspec-layout/package.json` stays — external consumers may import it directly. It now just has tokens and metadata (no selectors/defaults).

- [ ] **Step 4: Update test files that read default-theme.json directly**

In `packages/formspec-layout/tests/tokens.test.ts` (line 35) and `packages/formspec-react/tests/field-spacing-parity.test.ts` (line 35), these read the JSON file directly. Update to use `buildPlatformTheme()` instead, or keep the direct read if they're specifically testing the generated file's contents.

- [ ] **Step 5: Run full test suite**

```bash
cd packages/formspec-layout && npx vitest run
cd packages/formspec-react && npx vitest run
cd packages/formspec-studio-core && npx vitest run
cd packages/formspec-studio && npx vitest run tests/workspaces/theme/
npm run docs:check
```

Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: strip default-theme.json to tokens-only, remove stale build aliases"
```

---

### Task 7: Wire generation into the build pipeline

**Files:**
- Modify: root `package.json`
- Modify: `packages/formspec-layout/package.json`

- [ ] **Step 1: Add to root package.json scripts**

```json
"generate:theme": "node scripts/generate-theme-from-registry.mjs"
```

- [ ] **Step 2: Wire into docs:generate**

In the root `package.json`, the `docs:generate` script runs spec artifacts + filemap. Add theme generation to the chain:

```json
"docs:generate": "node scripts/generate-theme-from-registry.mjs && node scripts/generate-spec-artifacts.mjs && node scripts/generate-filemap.mjs"
```

- [ ] **Step 3: Add a check mode to the generation script**

Add a `--check` flag to `scripts/generate-theme-from-registry.mjs` that verifies outputs are up to date without writing:

```js
const checkMode = process.argv.includes('--check');
// ... after computing tokens, compare with existing file instead of writing
if (checkMode) {
    const existing = JSON.parse(readFileSync(themePath, 'utf-8'));
    const isEqual = JSON.stringify(existing.tokens) === JSON.stringify(tokens);
    if (!isEqual) {
        console.error('default-theme.json tokens are out of date. Run: npm run generate:theme');
        process.exit(1);
    }
    // ... similar checks for CSS and lint crate
    console.log('Theme artifacts are up to date.');
    process.exit(0);
}
```

Wire into `docs:check`:

```json
"docs:check": "node scripts/generate-theme-from-registry.mjs --check && node scripts/generate-spec-artifacts.mjs --check && node scripts/run-spec-contract-tests.mjs"
```

- [ ] **Step 4: Verify the full pipeline**

```bash
npm run docs:generate
npm run docs:check
```

Expected: Both pass. Modifying a registry value and running `docs:check` should fail.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/generate-theme-from-registry.mjs
git commit -m "build: wire theme generation into docs:generate and docs:check"
```
