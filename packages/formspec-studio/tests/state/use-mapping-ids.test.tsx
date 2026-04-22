import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { useMappingIds } from '../../src/state/useMappingIds';
import { useState, useEffect, useRef } from 'react';

function IdsRefChecker() {
  const { ids } = useMappingIds();
  const lastRef = useRef(ids);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (lastRef.current !== ids) {
      setChanged(true);
      lastRef.current = ids;
    }
  });
  return <div data-testid="ids-changed">{changed ? 'yes' : 'no'}</div>;
}

function TriggerParent() {
  const [tick, setTick] = useState(0);
  return (
    <div>
      <button data-testid="tick" onClick={() => setTick(t => t + 1)}>tick {tick}</button>
      <IdsRefChecker />
    </div>
  );
}

describe('useMappingIds', () => {
  it('returns stable array reference when mappings unchanged', () => {
    const project = createProject();
    render(
      <ProjectProvider project={project}>
        <TriggerParent />
      </ProjectProvider>
    );

    expect(screen.getByTestId('ids-changed')).toHaveTextContent('no');

    fireEvent.click(screen.getByTestId('tick'));
    expect(screen.getByTestId('ids-changed')).toHaveTextContent('no');
  });
});
