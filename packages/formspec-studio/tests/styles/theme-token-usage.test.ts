import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const studioRoot = resolve(__dirname, '../../');
const readStudioFile = (relativePath: string) =>
  readFileSync(resolve(studioRoot, relativePath), 'utf8');

describe('Studio theme token usage', () => {
  it('keeps Data workspace chrome on the shared light-theme token system', () => {
    const dataTab = readStudioFile('src/workspaces/data/DataTab');
    const dataSources = readStudioFile('src/workspaces/shared/DataSources');
    const optionSets = readStudioFile('src/workspaces/shared/OptionSets');

    expect(dataTab).not.toMatch(/border-neutral-\d+/);
    expect(dataSources).not.toMatch(/border-neutral-\d+/);
    expect(optionSets).not.toMatch(/border-neutral-\d+|bg-neutral-\d+/);
  });

  it('defines every referenced text color token in the studio theme', () => {
    const indexCss = readStudioFile('src/index.css');
    const itemRowContent = readStudioFile('src/workspaces/editor/ItemRowContent');

    expect(itemRowContent).toContain('text-ink');
    expect(indexCss).toContain('--color-ink:');
  });
});
