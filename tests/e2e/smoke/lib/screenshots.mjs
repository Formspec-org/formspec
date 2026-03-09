/**
 * Screenshot helper with auto-naming and auto-mkdir for smoke tests.
 */
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Take a screenshot, creating the output directory if needed.
 *
 * @param {import('playwright').Page} page
 * @param {string} dir   - Output directory (absolute path)
 * @param {string} name  - Filename (without directory), e.g. "01-initial.png"
 * @param {string} label - Human-readable label printed to stdout
 * @param {object} [opts]
 * @param {boolean} [opts.fullPage=false]
 * @returns {Promise<string>} Absolute path of the saved file
 */
export async function screenshot(page, dir, name, label, opts = {}) {
  const { fullPage = false } = opts;
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const filePath = path.join(dir, name);
  await page.screenshot({ path: filePath, fullPage });
  console.log(`[screenshot] ${label} -> ${filePath}`);
  return filePath;
}
