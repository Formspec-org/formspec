import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormPreviewV2 } from '../../src/chat-v2/components/FormPreviewV2';
import { useChatState, useChatSession } from '../../src/chat-v2/state/ChatContext';

// Mock the state and session hooks
vi.mock('../../src/chat-v2/state/ChatContext', () => ({
  useChatState: vi.fn(),
  useChatSession: vi.fn(),
}));

// Mock icons to avoid SVG rendering issues in tests
vi.mock('../../components/icons', () => ({
  IconRotate: () => <div data-testid="icon-rotate" />,
  IconUpload: () => <div data-testid="icon-upload" />,
  IconStack: () => <div data-testid="icon-file" />,
}));

const mockDef = {
  $formspec: '1.0',
  url: 'urn:test',
  version: '1.0.0',
  title: 'Test Form',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
  ],
};

const mockBundle = {
  definition: mockDef,
  component: { tree: { component: 'Stack', children: [] } },
  theme: { tokens: {} },
  mappings: {},
};

describe('FormPreviewV2', () => {
  const mockSession = {
    regenerate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useChatSession as any).mockReturnValue(mockSession);
  });

  it('renders empty state when no definition is present', () => {
    (useChatState as any).mockReturnValue({
      definition: null,
      bundle: null,
      traces: [],
      openIssueCount: 0,
    });

    render(<FormPreviewV2 />);
    expect(screen.getByText(/no form yet/i)).toBeInTheDocument();
  });

  it('renders "generating" state when scaffoldingText is present', () => {
    (useChatState as any).mockReturnValue({
      definition: null,
      bundle: null,
      traces: [],
      openIssueCount: 0,
      scaffoldingText: 'Generating definition...',
    });

    render(<FormPreviewV2 />);
    expect(screen.getByText(/generating\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText('Generating definition...')).toBeInTheDocument();
  });

  it('renders form title and items in visual mode', () => {
    (useChatState as any).mockReturnValue({
      definition: mockDef,
      bundle: mockBundle,
      traces: [],
      openIssueCount: 0,
    });

    render(<FormPreviewV2 />);
    expect(screen.getByText('Test Form')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('switches to JSON mode and shows raw definition', async () => {
    (useChatState as any).mockReturnValue({
      definition: mockDef,
      bundle: mockBundle,
      traces: [],
      openIssueCount: 0,
    });

    render(<FormPreviewV2 />);
    
    const jsonBtn = screen.getByTestId('preview-mode-json');
    fireEvent.click(jsonBtn);

    expect(screen.getByTestId('json-doc-definition-content')).toBeInTheDocument();
    expect(screen.getByTestId('json-doc-definition-content').textContent).toContain('"title": "Test Form"');
  });

  it('calls session.regenerate when Regenerate button is clicked', async () => {
    (useChatState as any).mockReturnValue({
      definition: mockDef,
      bundle: mockBundle,
      traces: [],
      openIssueCount: 0,
    });

    render(<FormPreviewV2 />);
    
    const regenBtn = screen.getByTestId('regenerate-btn');
    await act(async () => {
      fireEvent.click(regenBtn);
    });

    expect(mockSession.regenerate).toHaveBeenCalledTimes(1);
  });

  it('displays diff summary when lastDiff is present', () => {
    (useChatState as any).mockReturnValue({
      definition: mockDef,
      bundle: mockBundle,
      traces: [],
      openIssueCount: 0,
      lastDiff: {
        added: ['age'],
        removed: [],
        modified: ['name'],
      },
    });

    render(<FormPreviewV2 />);
    const summary = screen.getByTestId('diff-summary');
    expect(summary).toBeInTheDocument();
    expect(summary.textContent).toContain('+1 added');
    expect(summary.textContent).toContain('~1 modified');
  });

  it('highlights added and modified fields', () => {
    (useChatState as any).mockReturnValue({
      definition: mockDef,
      bundle: mockBundle,
      traces: [],
      openIssueCount: 0,
      lastDiff: {
        added: ['age'],
        removed: [],
        modified: ['name'],
      },
    });

    render(<FormPreviewV2 />);
    
    const ageCard = screen.getByTestId('layout-field-age').closest('.v2-field-card');
    expect(ageCard).toHaveClass('v2-field-added');

    const nameCard = screen.getByTestId('layout-field-name').closest('.v2-field-card');
    expect(nameCard).toHaveClass('v2-field-modified');
  });
});
