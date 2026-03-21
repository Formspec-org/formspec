/** @filedesc Compiles uswds-formspec.scss — resolves USWDS load path for npm workspace hoisting. */

import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { findPackageJSON } from 'node:module';

// Locate the @uswds/uswds package root regardless of workspace hoisting.
const pkgJson = findPackageJSON('@uswds/uswds', import.meta.url);
const loadPath = join(dirname(pkgJson), 'packages');

execSync(
  `npx sass src/uswds/uswds-formspec.scss dist/uswds-formspec.css --style=compressed --load-path=${loadPath} --quiet-deps`,
  { stdio: 'inherit' },
);
