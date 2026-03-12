import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const studioRoot = resolve(__dirname, '../../');
const readStudioFile = (relativePath: string) =>
  readFileSync(resolve(studioRoot, relativePath), 'utf8');

describe('Studio theme token usage', () => {
  it('keeps Data workspace chrome on the shared light-theme token system', () => {
    const dataTab = readStudioFile('src/workspaces/data/DataTab.tsx');
    const responseSchema = readStudioFile('src/workspaces/data/ResponseSchema.tsx');
    const dataSources = readStudioFile('src/workspaces/data/DataSources.tsx');
    const optionSets = readStudioFile('src/workspaces/data/OptionSets.tsx');

    expect(dataTab).not.toMatch(/border-neutral-\d+/);
    expect(responseSchema).not.toMatch(/border-neutral-\d+/);
    expect(dataSources).not.toMatch(/border-neutral-\d+/);
    expect(optionSets).not.toMatch(/border-neutral-\d+|bg-neutral-\d+/);
  });

  it('defines every referenced text color token in the studio theme', () => {
    const indexCss = readStudioFile('src/index.css');
    const dataTab = readStudioFile('src/workspaces/data/DataTab.tsx');
    const displayBlock = readStudioFile('src/workspaces/editor/DisplayBlock.tsx');

    expect(dataTab).toContain('text-foreground');
    expect(displayBlock).toContain('text-foreground');
    expect(indexCss).toContain('--color-foreground:');
  });
});
