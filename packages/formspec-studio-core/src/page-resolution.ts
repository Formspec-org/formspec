import type { ProjectState } from './types.js';

// ── Public types ─────────────────────────────────────────────────────

export interface ResolvedPage {
  id: string;
  title?: string;
  description?: string;
  regions?: { key?: string; span?: number; start?: number }[];
}

export interface PageDiagnostic {
  code: 'SHADOWED_THEME_PAGES' | 'UNKNOWN_REGION_KEY' | 'PAGEMODE_MISMATCH';
  severity: 'warning' | 'error';
  message: string;
}

export interface ResolvedPageStructure {
  mode: 'single' | 'wizard' | 'tabs';
  pages: ResolvedPage[];
  controllingTier: 'component' | 'theme' | 'definition' | 'none';
  diagnostics: PageDiagnostic[];
  wizardConfig: { showProgress: boolean; allowSkip: boolean };
}

// ── Helpers ──────────────────────────────────────────────────────────

interface WizardNode {
  component: string;
  props?: Record<string, unknown>;
  children?: WizardNode[];
}

/** Walk the component tree looking for a root Wizard component. */
function findWizard(tree: unknown): WizardNode | null {
  if (!tree || typeof tree !== 'object') return null;
  const node = tree as WizardNode;
  if (node.component === 'Wizard') return node;
  return null;
}

/** Extract pages from WizardPage children of a Wizard node. */
function pagesFromWizard(wizard: WizardNode): ResolvedPage[] {
  if (!wizard.children) return [];
  return wizard.children
    .filter((c) => c.component === 'WizardPage')
    .map((c, i) => ({
      id: `wizard-page-${i}`,
      title: (c.props?.title as string) ?? undefined,
      description: (c.props?.description as string) ?? undefined,
      regions: [],
    }));
}

/** Extract pages from theme.pages array. */
function pagesFromTheme(themePages: unknown[]): ResolvedPage[] {
  return themePages.map((p: any) => ({
    id: p.id ?? '',
    title: p.title,
    description: p.description,
    regions: p.regions ?? [],
  }));
}

/** Infer pages from definition groups that have layout.page hints. */
function pagesFromDefinitionGroups(items: any[]): ResolvedPage[] {
  const pageMap = new Map<string, ResolvedPage>();
  for (const item of items) {
    if (item.type !== 'group') continue;
    const pageHint = item.layout?.page;
    if (!pageHint) continue;
    if (!pageMap.has(pageHint)) {
      pageMap.set(pageHint, {
        id: pageHint,
        title: item.label ?? item.key,
        regions: [],
      });
    }
    const page = pageMap.get(pageHint)!;
    // Add all children keys as regions
    if (item.children) {
      for (const child of item.children) {
        page.regions!.push({ key: child.key });
      }
    }
  }
  return Array.from(pageMap.values());
}

// ── Main resolution function ─────────────────────────────────────────

/**
 * Resolves the current page structure by reading all three tiers.
 *
 * Priority: Tier 3 Wizard component → Tier 2 theme.pages → Tier 1 definition groups → none.
 */
export function resolvePageStructure(
  state: ProjectState,
  definitionItemKeys: string[],
): ResolvedPageStructure {
  const diagnostics: PageDiagnostic[] = [];
  const def = state.definition as any;
  const themePages = (state.theme.pages ?? []) as any[];
  const hasThemePages = themePages.length > 0;
  const pageMode: string = def.formPresentation?.pageMode ?? 'single';
  const defaultWizardConfig = { showProgress: false, allowSkip: false };

  // ── Tier 3: Component Wizard ───────────────────────────────────
  const wizard = findWizard(state.component.tree);
  if (wizard) {
    if (hasThemePages) {
      diagnostics.push({
        code: 'SHADOWED_THEME_PAGES',
        severity: 'warning',
        message: 'A Wizard component exists in the component tree. Theme pages are shadowed and will not be used.',
      });
    }
    const props = wizard.props ?? {};
    return {
      mode: 'wizard',
      pages: pagesFromWizard(wizard),
      controllingTier: 'component',
      diagnostics,
      wizardConfig: {
        showProgress: (props.showProgress as boolean) ?? false,
        allowSkip: (props.allowSkip as boolean) ?? false,
      },
    };
  }

  // ── Tier 2: Theme pages ────────────────────────────────────────
  if (hasThemePages) {
    // Check for pageMode mismatch
    if (pageMode === 'single') {
      diagnostics.push({
        code: 'PAGEMODE_MISMATCH',
        severity: 'warning',
        message: 'Theme pages exist but definition pageMode is "single". Pages may not render.',
      });
    }

    // Check for unknown region keys
    const knownKeys = new Set(definitionItemKeys);
    for (const page of themePages) {
      for (const region of page.regions ?? []) {
        if (region.key && !knownKeys.has(region.key)) {
          diagnostics.push({
            code: 'UNKNOWN_REGION_KEY',
            severity: 'warning',
            message: `Region key "${region.key}" on page "${page.title ?? page.id}" does not match any definition item.`,
          });
        }
      }
    }

    return {
      mode: pageMode === 'tabs' ? 'tabs' : 'wizard',
      pages: pagesFromTheme(themePages),
      controllingTier: 'theme',
      diagnostics,
      wizardConfig: defaultWizardConfig,
    };
  }

  // ── Tier 1: Definition groups with layout.page ─────────────────
  const defItems = def.items ?? [];
  const inferredPages = pagesFromDefinitionGroups(defItems);
  if (inferredPages.length > 0 && pageMode !== 'single') {
    return {
      mode: pageMode === 'tabs' ? 'tabs' : 'wizard',
      pages: inferredPages,
      controllingTier: 'definition',
      diagnostics,
      wizardConfig: defaultWizardConfig,
    };
  }

  // ── User chose wizard/tabs but no theme pages yet ───────────────
  // Honor formPresentation.pageMode so the mode selector and Add Page /
  // Generate from Groups are visible; avoids catch-22 where user cannot
  // enter wizard from a single-page form via the Pages tab.
  if (pageMode === 'wizard' || pageMode === 'tabs') {
    return {
      mode: pageMode === 'tabs' ? 'tabs' : 'wizard',
      pages: [],
      controllingTier: 'theme',
      diagnostics,
      wizardConfig: defaultWizardConfig,
    };
  }

  // ── None ───────────────────────────────────────────────────────
  return {
    mode: 'single',
    pages: [],
    controllingTier: 'none',
    diagnostics,
    wizardConfig: defaultWizardConfig,
  };
}
