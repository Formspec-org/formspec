import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EditorContextMenu } from '../../../src/workspaces/editor/EditorContextMenu';

describe('EditorContextMenu', () => {
  it('shows standard menu items', () => {
    render(
      <EditorContextMenu
        itemPath="name"
        itemType="field"
        onAction={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/duplicate/i)).toBeInTheDocument();
    expect(screen.getByText(/delete/i)).toBeInTheDocument();
    expect(screen.getByText(/move up/i)).toBeInTheDocument();
    expect(screen.getByText(/move down/i)).toBeInTheDocument();
  });

  it('shows wrap in group option', () => {
    render(
      <EditorContextMenu
        itemPath="name"
        itemType="field"
        onAction={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/wrap in group/i)).toBeInTheDocument();
  });
});
