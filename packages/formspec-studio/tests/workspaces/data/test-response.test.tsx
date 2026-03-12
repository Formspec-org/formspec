import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TestResponse } from '../../../src/workspaces/data/TestResponse';

describe('TestResponse', () => {
  it('renders real test-response authoring content instead of a placeholder stub', () => {
    render(<TestResponse />);
    expect(screen.queryByText(/future implementation/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run test|generate response|validate response/i })).toBeInTheDocument();
  });
});
