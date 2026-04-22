import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ActiveGroupProvider, useActiveGroup } from '../../src/state/useActiveGroup';
import { useState, useEffect, useRef, useCallback } from 'react';

function StableRefChecker() {
  const ctx = useActiveGroup();
  const lastRef = useRef(ctx);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (lastRef.current !== ctx) {
      setChanged(true);
      lastRef.current = ctx;
    }
  });
  return <div data-testid="context-changed">{changed ? 'yes' : 'no'}</div>;
}

function ChildThatGetsNewKey() {
  return <StableRefChecker />;
}

function TriggerParent() {
  const [tick, setTick] = useState(0);
  return (
    <div>
      <button data-testid="tick" onClick={() => setTick(t => t + 1)}>tick {tick}</button>
      <ActiveGroupProvider key="stable">
        <ChildThatGetsNewKey />
      </ActiveGroupProvider>
    </div>
  );
}

describe('ActiveGroupProvider', () => {
  it('memoizes context value to avoid unnecessary re-renders', () => {
    const { getByTestId } = render(<TriggerParent />);

    expect(getByTestId('context-changed')).toHaveTextContent('no');

    fireEvent.click(getByTestId('tick'));
    expect(getByTestId('context-changed')).toHaveTextContent('no');

    fireEvent.click(getByTestId('tick'));
    expect(getByTestId('context-changed')).toHaveTextContent('no');
  });
});
