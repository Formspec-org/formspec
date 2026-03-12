import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TestResponse } from '../../../src/workspaces/data/TestResponse';

describe('TestResponse', () => {
  it('renders an informational not-yet-implemented state without a fake run button', () => {
    render(<TestResponse />);
    expect(screen.getByText(/not yet implemented/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run test|generate response|validate response/i })).toBeNull();
  });
});
