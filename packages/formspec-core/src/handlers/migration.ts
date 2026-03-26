/** @filedesc Migrates deprecated Wizard/Tabs root component trees to Stack roots on project load. */

export interface WizardRootMigrationResult {
  /** The rewritten component tree with Stack as root. */
  tree: Record<string, unknown>;
  /** Props extracted from the old root to be applied to formPresentation. */
  migratedProps: Record<string, unknown>;
  /** The presentation mode implied by the old root type. */
  migratedMode: 'wizard' | 'tabs';
}

/**
 * Migrate a deprecated Wizard or Tabs root to a Stack root.
 *
 * Returns null when no migration is needed (root is already Stack or another type).
 * Only migrates top-level Wizard/Tabs — nested Tabs inside Pages are untouched.
 */
export function migrateWizardRoot(
  tree: Record<string, unknown> | null | undefined,
): WizardRootMigrationResult | null {
  if (!tree || typeof tree !== 'object') return null;

  const component = tree.component as string | undefined;

  if (component === 'Wizard') {
    const { component: _c, showProgress, allowSkip, ...rest } = tree;
    const migratedProps: Record<string, unknown> = {};
    if (showProgress !== undefined) migratedProps.showProgress = showProgress;
    if (allowSkip !== undefined) migratedProps.allowSkip = allowSkip;
    return {
      tree: { ...rest, component: 'Stack' },
      migratedProps,
      migratedMode: 'wizard',
    };
  }

  if (component === 'Tabs') {
    const { component: _c, position, defaultTab, ...rest } = tree;
    const migratedProps: Record<string, unknown> = {};
    if (position !== undefined) migratedProps.tabPosition = position;
    if (defaultTab !== undefined) migratedProps.defaultTab = defaultTab;
    return {
      tree: { ...rest, component: 'Stack' },
      migratedProps,
      migratedMode: 'tabs',
    };
  }

  return null;
}
