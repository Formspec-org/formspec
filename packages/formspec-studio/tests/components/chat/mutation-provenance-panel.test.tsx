import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createProject } from '@formspec-org/studio-core';
import { MutationProvenancePanel } from '../../../src/components/chat/MutationProvenancePanel';
import { recordAiPatchLifecycle } from '../../../src/workspaces/shared/studio-intelligence-writer';
import type { ChangesetReviewData } from '../../../src/components/ChangesetReview';

function makeChangeset(id: string): ChangesetReviewData {
  return {
    id,
    status: 'pending',
    label: 'AI update',
    aiEntries: [
      {
        toolName: 'set_bind',
        summary: 'Add required bind',
        affectedPaths: ['items.name'],
        warnings: [],
      },
    ],
    userOverlay: [],
    dependencyGroups: [],
  };
}

describe('MutationProvenancePanel', () => {
  it('shows provenance tied to the current changeset', () => {
    const project = createProject();
    recordAiPatchLifecycle(project, {
      changesetId: 'cs-1',
      summary: 'Bind update',
      affectedRefs: ['items.name'],
      status: 'accepted',
      capability: 'bind_rules',
    });

    render(<MutationProvenancePanel changeset={makeChangeset('cs-1')} project={project} />);

    expect(screen.getByTestId('mutation-provenance-panel')).toBeInTheDocument();
    expect(screen.getByText('Data connection')).toBeInTheDocument();
    expect(screen.getByText('items.name')).toBeInTheDocument();
  });

  it('does not show provenance from a different changeset', () => {
    const project = createProject();
    recordAiPatchLifecycle(project, {
      changesetId: 'other',
      summary: 'Bind update',
      affectedRefs: ['items.name'],
      status: 'accepted',
      capability: 'bind_rules',
    });

    render(<MutationProvenancePanel changeset={makeChangeset('cs-1')} project={project} />);

    expect(screen.queryByTestId('mutation-provenance-panel')).not.toBeInTheDocument();
  });
});
