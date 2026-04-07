/**
 * @filedesc Ensures layout primitives exclude `formspec-stack.grid-row` from forced column flex (USWDS adapter combines both classes on one node).
 *
 * **Computed-style truth:** `tests/storybook/uswds-grant-story-dom.spec.ts` probes the live Storybook iframe at
 * `examples-uswds-grant-form--with-uswds-adapter` and asserts `getComputedStyle(.formspec-stack.grid-row).flexDirection === 'row'`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

describe('formspec-stack + USWDS grid-row (source contract)', () => {
    it('vertical stack column flex is scoped with :not(.grid-row)', () => {
        const testDir = dirname(fileURLToPath(import.meta.url));
        const primitivesPath = join(testDir, '../src/styles/layout.primitives.css');
        const css = readFileSync(primitivesPath, 'utf8');

        const notGridIdx = css.indexOf('.formspec-stack:not(.grid-row)');
        expect(notGridIdx, 'primitives must scope column stack to :not(.grid-row)').toBeGreaterThan(-1);

        const slice = css.slice(notGridIdx, notGridIdx + 400);
        expect(slice).toContain('flex-direction: column');

        const secondNotGrid = css.indexOf('.formspec-stack:not(.grid-row)', notGridIdx + 1);
        expect(secondNotGrid, 'gap rule must also use :not(.grid-row)').toBeGreaterThan(-1);
        expect(css.slice(secondNotGrid, secondNotGrid + 120)).toContain('gap:');
    });
});
