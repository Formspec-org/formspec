import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { waitForApp, waitForAppWithExport, switchTab, importProject } from './helpers';
import { createProject, type ProjectBundle } from 'formspec-studio-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SINGLE_PAGE_SEED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:pages-e2e',
    version: '1.0.0',
    items: [
      { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
      { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
    ],
  },
};

const WIZARD_THEME_SEED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:pages-e2e',
    version: '1.0.0',
    title: 'Pages E2E',
    status: 'draft',
    formPresentation: { pageMode: 'wizard' },
    items: [
      { key: 'step1', type: 'group', label: 'Step 1', children: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name' }] },
      { key: 'step2', type: 'group', label: 'Step 2', children: [{ key: 'email', type: 'field', dataType: 'string', label: 'Email' }] },
    ],
  },
  theme: {
    pages: [
      { id: 'p1', title: 'Step 1', regions: [{ key: 'name', span: 12 }] },
      { id: 'p2', title: 'Step 2', regions: [{ key: 'email', span: 6 }] },
    ],
  },
};

const GROUPS_WITH_PAGE_HINTS_SEED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:pages-e2e',
    version: '1.0.0',
    formPresentation: { pageMode: 'single' },
    items: [
      {
        key: 'personal',
        type: 'group',
        label: 'Personal',
        layout: { page: 'page1' },
        children: [{ key: 'name', type: 'field', dataType: 'string', label: 'Name' }],
      },
      {
        key: 'contact',
        type: 'group',
        label: 'Contact',
        layout: { page: 'page2' },
        children: [{ key: 'email', type: 'field', dataType: 'string', label: 'Email' }],
      },
    ],
  },
};

const PAGEMODE_MISMATCH_SEED = {
  definition: {
    $formspec: '1.0',
    url: 'urn:pages-e2e',
    version: '1.0.0',
    formPresentation: { pageMode: 'single' },
    items: [{ key: 'x', type: 'field', dataType: 'string', label: 'X' }],
  },
  theme: {
    pages: [{ id: 'orphan', title: 'Orphan', regions: [] }],
  },
};

test.describe('Pages Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test('Pages tab renders and shows single-page banner when mode is single', async ({ page }) => {
    await importProject(page, SINGLE_PAGE_SEED);
    await switchTab(page, 'Pages');

    const workspace = page.locator('[data-testid="workspace-Pages"]');
    await expect(workspace.getByText(/single-page form/i)).toBeVisible();
    await expect(workspace.getByTestId('tier-status-banner')).toBeVisible();
  });

  test('mode selector has Single, Wizard, Tabs and wizard mode shows add page and generate buttons', async ({
    page,
  }) => {
    await importProject(page, WIZARD_THEME_SEED);
    await switchTab(page, 'Pages');

    const workspace = page.locator('[data-testid="workspace-Pages"]');
    await expect(workspace.getByRole('button', { name: 'Single' })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Wizard' })).toBeVisible();
    await expect(workspace.getByRole('button', { name: 'Tabs' })).toBeVisible();
    await expect(workspace.getByRole('button', { name: /add page/i })).toBeVisible();
    await expect(workspace.getByRole('button', { name: /generate/i })).toBeVisible();
  });

  test('clicking Wizard shows Add Page and Generate from Groups (no catch-22)', async ({
    page,
  }) => {
    await importProject(page, SINGLE_PAGE_SEED);
    await switchTab(page, 'Pages');

    const workspace = page.locator('[data-testid="workspace-Pages"]');
    await expect(workspace.getByText(/single-page form/i)).toBeVisible();
    await expect(workspace.getByRole('button', { name: /add page/i })).not.toBeVisible();

    await workspace.getByRole('button', { name: 'Wizard' }).click();

    await expect(workspace.getByRole('button', { name: /add page/i })).toBeVisible({ timeout: 2000 });
    await expect(workspace.getByRole('button', { name: /generate/i })).toBeVisible();
  });

  test('add page button creates a new page card', async ({ page }) => {
    await importProject(page, WIZARD_THEME_SEED);
    await switchTab(page, 'Pages');

    const workspace = page.locator('[data-testid="workspace-Pages"]');
    await expect(workspace.getByText('Step 1')).toBeVisible();
    await expect(workspace.getByText('Step 2')).toBeVisible();

    await workspace.getByRole('button', { name: /add page/i }).click();

    await expect(workspace.getByText(/Page 3/)).toBeVisible({ timeout: 2000 });
  });

  test('page cards show titles and region counts', async ({ page }) => {
    await importProject(page, WIZARD_THEME_SEED);
    await switchTab(page, 'Pages');

    const workspace = page.locator('[data-testid="workspace-Pages"]');
    await expect(workspace.getByText('Step 1')).toBeVisible();
    await expect(workspace.getByText('Step 2')).toBeVisible();
    await expect(workspace.locator('text=1 region')).toHaveCount(2);
  });

  test('auto-generate creates pages from definition groups with layout.page', async ({ page }) => {
    await importProject(page, GROUPS_WITH_PAGE_HINTS_SEED);
    await switchTab(page, 'Pages');

    const workspace = page.locator('[data-testid="workspace-Pages"]');
    await workspace.getByRole('button', { name: 'Wizard' }).click();
    await workspace.getByRole('button', { name: /generate/i }).click();

    await expect(workspace.getByText('Personal')).toBeVisible({ timeout: 2000 });
    await expect(workspace.getByText('Contact')).toBeVisible();
  });

  test('diagnostics panel shows PAGEMODE_MISMATCH when theme has pages but definition is single', async ({
    page,
  }) => {
    await importProject(page, PAGEMODE_MISMATCH_SEED);
    await switchTab(page, 'Pages');

    const workspace = page.locator('[data-testid="workspace-Pages"]');
    await expect(workspace.getByText(/PAGEMODE_MISMATCH|mismatch/i)).toBeVisible();
  });

  test('tier status banner shows wizard shadowed message when component Wizard exists', async ({
    page,
  }) => {
    await importProject(page, {
      definition: {
        $formspec: '1.0',
        url: 'urn:pages-e2e',
        version: '1.0.0',
        items: [{ key: 'f', type: 'field', dataType: 'string', label: 'F' }],
      },
      theme: {
        pages: [{ id: 'tp', title: 'Theme Page', regions: [] }],
      },
      component: {
        $formspecComponent: '1.0',
        tree: {
          component: 'Wizard',
          children: [
            { component: 'WizardPage', props: { title: 'Comp Page' }, children: [] },
          ],
        },
      },
    });
    await switchTab(page, 'Pages');

    const workspace = page.locator('[data-testid="workspace-Pages"]');
    const banner = workspace.getByTestId('tier-status-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/wizard component|shadowed/i);
  });

  test('can navigate to Pages and back to Editor', async ({ page }) => {
    await importProject(page, SINGLE_PAGE_SEED);
    await switchTab(page, 'Pages');
    await expect(page.locator('[data-testid="workspace-Pages"]')).toBeVisible();

    await switchTab(page, 'Editor');
    await expect(page.locator('[data-testid="tab-Editor"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('[data-testid="workspace-Editor"]')).toBeVisible();
  });

  test('Pages wizard config is reflected in Preview', async ({ page }) => {
    await importProject(page, WIZARD_THEME_SEED);
    await switchTab(page, 'Pages');
    await expect(page.locator('[data-testid="workspace-Pages"]').getByText('Step 1')).toBeVisible();

    await switchTab(page, 'Preview');
    const preview = page.locator('[data-testid="workspace-Preview"]');
    await expect(preview.getByLabel('Name')).toBeVisible({ timeout: 3000 });
    await expect(preview.getByRole('button', { name: /continue|next/i }).first()).toBeVisible();

    await preview.getByRole('button', { name: /continue|next/i }).first().click();
    await expect(preview.getByLabel('Email')).toBeVisible({ timeout: 2000 });

    await preview.getByRole('button', { name: /continue|next/i }).first().click();
    await expect(preview.getByRole('button', { name: /submit/i }).first()).toBeVisible({ timeout: 2000 });
  });
});

test.describe('Pages Workspace — export validation', () => {
  test('exported project bundle passes Node diagnose', async ({ page }) => {
    await waitForAppWithExport(page);
    await importProject(page, WIZARD_THEME_SEED);
    await switchTab(page, 'Pages');
    await expect(page.locator('[data-testid="workspace-Pages"]').getByText('Step 1')).toBeVisible();

    const bundle = await page.evaluate(() => {
      const fn = (window as unknown as { __FORMSPEC_TEST_EXPORT?: () => unknown }).__FORMSPEC_TEST_EXPORT;
      if (!fn) throw new Error('__FORMSPEC_TEST_EXPORT not set (open app with ?e2e=1)');
      return fn();
    }) as ProjectBundle;

    const project = createProject({ seed: bundle });
    const diagnostics = project.diagnose();
    // Print so we can review validation results
    console.log('\n--- Node diagnose (exported bundle) ---');
    console.log('counts:', JSON.stringify(diagnostics.counts, null, 2));
    for (const [name, list] of [
      ['structural', diagnostics.structural],
      ['expressions', diagnostics.expressions],
      ['extensions', diagnostics.extensions],
      ['consistency', diagnostics.consistency],
    ] as const) {
      if (list.length > 0) {
        console.log(`${name} (${list.length}):`, list.map((d) => ({ ...d })));
      }
    }
    expect(diagnostics.counts.error).toBe(0);
  });

  test('exported project bundle validates with Python formspec.validate', async ({ page }) => {
    await waitForAppWithExport(page);
    await importProject(page, WIZARD_THEME_SEED);
    await switchTab(page, 'Pages');

    const bundle = await page.evaluate(() => {
      const fn = (window as unknown as { __FORMSPEC_TEST_EXPORT?: () => unknown }).__FORMSPEC_TEST_EXPORT;
      if (!fn) throw new Error('__FORMSPEC_TEST_EXPORT not set');
      return fn();
    }) as ProjectBundle;

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'formspec-e2e-'));
    try {
      fs.writeFileSync(path.join(dir, 'definition.json'), JSON.stringify(bundle.definition, null, 2));
      fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify(bundle.theme, null, 2));
      fs.writeFileSync(path.join(dir, 'component.json'), JSON.stringify(bundle.component, null, 2));
      fs.writeFileSync(path.join(dir, 'mapping.json'), JSON.stringify(bundle.mapping, null, 2));

      const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
      const registryPath = path.join(repoRoot, 'registries', 'formspec-common.registry.json');
      const args = ['-m', 'formspec.validate', dir];
      if (fs.existsSync(registryPath)) {
        args.push('--registry', registryPath);
      }
      const result = spawnSync('python3', args, {
        encoding: 'utf-8',
        cwd: repoRoot,
        env: { ...process.env, PYTHONPATH: path.join(repoRoot, 'src') },
      });
      // Print so we can review validation results
      console.log('\n--- Python formspec.validate (exported bundle) ---');
      if (result.stdout) console.log(result.stdout);
      if (result.stderr) console.log('stderr:', result.stderr);
      expect(result.status, result.stderr || result.stdout).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
