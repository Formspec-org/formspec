import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConditionBuilder } from '../../../src/components/ui/ConditionBuilder';
import { useState } from 'react';

const mockFields = [
  { path: 'age', label: 'Age', dataType: 'integer' },
  { path: 'name', label: 'Name', dataType: 'string' },
];

function Wrapper({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <div>
      <div data-testid="current-value">{value}</div>
      <ConditionBuilder
        value={value}
        onSave={setValue}
        fields={mockFields}
      />
      <button data-testid="external-change" onClick={() => setValue("sum($items[*].amount)")} />
    </div>
  );
}

describe('ConditionBuilder prop sync', () => {
  it('resets to advanced mode when external value becomes unparseable', () => {
    render(<Wrapper initialValue="$age >= 18" />);

    expect(screen.getByText(/all/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('external-change'));

    expect(screen.getByText('Guided')).toBeInTheDocument();
    expect(screen.getByTestId('current-value')).toHaveTextContent('sum($items[*].amount)');
  });
});
