import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { MappingPreview } from '../../../src/workspaces/mapping/MappingPreview';

// Mock FormEngine to avoid actual heavy logic if needed,
// but we want to test the integration, so let's ensure it works with a real-ish setup.

function renderMappingPreview(project: any) {
  return render(
    <ProjectProvider project={project}>
      <MappingPreview />
    </ProjectProvider>
  );
}

describe('MappingPreview Sync', () => {
  it('generates sample data from form definition when Sync button is clicked', async () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test',
          version: '1.0.0',
          items: [
            { key: 'user_name', type: 'field', dataType: 'string', label: 'User Name' },
            { key: 'user_age', type: 'field', dataType: 'integer', label: 'Age' }
          ]
        } as any,
        mappings: {
          default: {
            direction: 'forward',
            rules: [
              { sourcePath: 'user_name', targetPath: 'displayName', transform: 'preserve' }
            ]
          } as any
        }
      }
    });

    renderMappingPreview(project);

    // Initial state check (static sample)
    expect(screen.getByDisplayValue(/Jane/i)).toBeInTheDocument();

    // Click Sync — generateDefinitionSampleData is now async
    const syncBtn = screen.getByRole('button', { name: /sync with form/i });
    fireEvent.click(syncBtn);

    // Wait for the async sample generation to complete and update the textarea
    await waitFor(() => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const content = textarea.value;
      expect(content).toContain('user_name');
    });

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const content = textarea.value;
    expect(content).toContain('user_age');

    // Verify it produced a valid JSON
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty('user_name');
    expect(parsed).toHaveProperty('user_age');
  });

  it('handles repeatable groups by adding at least one instance', async () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test-repeat',
          version: '1.0.0',
          items: [
            {
              key: 'children',
              type: 'group',
              repeatable: true,
              children: [
                { key: 'child_name', type: 'field', dataType: 'string' }
              ]
            }
          ]
        } as any,
        mappings: {
          default: { direction: 'forward', rules: [] } as any
        }
      }
    });

    renderMappingPreview(project);

    fireEvent.click(screen.getByRole('button', { name: /sync with form/i }));

    // Wait for the async sample generation to complete
    await waitFor(() => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const parsed = JSON.parse(textarea.value);
      expect(Array.isArray(parsed.children)).toBe(true);
    });

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value);
    expect(parsed.children.length).toBeGreaterThan(0);
    expect(parsed.children[0]).toHaveProperty('child_name');
  });
});
