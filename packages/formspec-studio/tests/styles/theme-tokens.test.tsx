import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider } from '../../src/state/useSelection';
import { DataTab } from '../../src/workspaces/data/DataTab';
import { DisplayBlock } from '../../src/workspaces/editor/DisplayBlock';

const cssPath = resolve(process.cwd(), 'src/index.css');
const css = readFileSync(cssPath, 'utf8');

const dataDef = {
  $formspec: '1.0',
  url: 'urn:data-theme',
  version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
  ],
};

describe('Studio theme tokens', () => {
  it('defines a foreground token when components use text-foreground utilities', () => {
    render(
      <DisplayBlock
        itemKey="notice"
        itemPath="notice"
        registerTarget={() => {}}
        label="Important Notice"
        depth={0}
        selected={false}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('Important Notice')).toHaveClass('text-foreground');
    expect(css).toMatch(/--color-foreground\s*:/);
  });

  it('keeps the Data workspace on the light shell token palette instead of neutral dark-theme borders', () => {
    const project = createProject({ seed: { definition: dataDef as any } });

    const { container } = render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <DataTab />
        </SelectionProvider>
      </ProjectProvider>
    );

    expect(screen.getByRole('button', { name: /sources/i })).not.toHaveClass('hover:text-foreground');
    // No neutral dark-theme borders anywhere in the Data workspace
    expect(container.innerHTML).not.toMatch(/border-neutral-\d+/);
    expect(container.innerHTML).not.toMatch(/bg-neutral-\d+/);
  });
});
