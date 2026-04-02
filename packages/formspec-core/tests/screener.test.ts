import { describe, it, expect } from 'vitest';
import { createRawProject } from '../src/index.js';
import type { ScreenerDocument } from '@formspec-org/types';

function makeScreener(overrides: Partial<ScreenerDocument> = {}): ScreenerDocument {
  return {
    $formspecScreener: '1.0',
    url: 'urn:test:screener',
    version: '1.0.0',
    title: 'Test Screener',
    items: [],
    evaluation: [],
    ...overrides,
  } as ScreenerDocument;
}

function projectWithScreener(screener?: ScreenerDocument) {
  return createRawProject({
    seed: { screener: screener ?? makeScreener() },
  });
}

// ── Document lifecycle ───────────────────────────────────────────

describe('screener.setDocument', () => {
  it('loads a screener document', () => {
    const project = createRawProject();
    expect(project.state.screener).toBeNull();

    const doc = makeScreener();
    project.dispatch({ type: 'screener.setDocument', payload: doc });
    expect(project.state.screener).not.toBeNull();
    expect(project.state.screener!.title).toBe('Test Screener');
  });

  it('replaces an existing screener document', () => {
    const project = projectWithScreener();
    const newDoc = makeScreener({ title: 'Updated Screener', version: '2.0.0' });
    project.dispatch({ type: 'screener.setDocument', payload: newDoc });
    expect(project.state.screener!.title).toBe('Updated Screener');
    expect(project.state.screener!.version).toBe('2.0.0');
  });
});

describe('screener.remove', () => {
  it('removes the screener document', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.remove', payload: {} });
    expect(project.state.screener).toBeNull();
  });
});

// ── Items ────────────────────────────────────────────────────────

describe('screener.addItem', () => {
  it('adds a field item', () => {
    const project = projectWithScreener();
    project.dispatch({
      type: 'screener.addItem',
      payload: { type: 'field', key: 'orgType', label: 'Organization Type', dataType: 'choice' },
    });
    expect(project.state.screener!.items).toHaveLength(1);
    expect((project.state.screener!.items[0] as any).key).toBe('orgType');
  });

  it('inserts at specified index', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addItem', payload: { type: 'field', key: 'a', label: 'A' } });
    project.dispatch({ type: 'screener.addItem', payload: { type: 'field', key: 'c', label: 'C' } });
    project.dispatch({ type: 'screener.addItem', payload: { type: 'field', key: 'b', label: 'B', insertIndex: 1 } });
    const keys = project.state.screener!.items.map((i: any) => i.key);
    expect(keys).toEqual(['a', 'b', 'c']);
  });
});

describe('screener.deleteItem', () => {
  it('removes the item by key', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addItem', payload: { type: 'field', key: 'q1', label: 'Q1' } });
    project.dispatch({ type: 'screener.deleteItem', payload: { key: 'q1' } });
    expect(project.state.screener!.items).toHaveLength(0);
  });

  it('cleans up binds referencing deleted item', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addItem', payload: { type: 'field', key: 'q1', label: 'Q1' } });
    project.dispatch({ type: 'screener.setBind', payload: { path: 'q1', properties: { required: 'true' } } });
    expect(project.state.screener!.binds).toHaveLength(1);

    project.dispatch({ type: 'screener.deleteItem', payload: { key: 'q1' } });
    expect(project.state.screener!.binds).toBeUndefined();
  });
});

describe('screener.setItemProperty', () => {
  it('updates an allowed property', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addItem', payload: { type: 'field', key: 'q1', label: 'Q1' } });
    project.dispatch({ type: 'screener.setItemProperty', payload: { key: 'q1', property: 'label', value: 'Question 1' } });
    expect((project.state.screener!.items[0] as any).label).toBe('Question 1');
  });

  it('rejects disallowed properties', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addItem', payload: { type: 'field', key: 'q1', label: 'Q1' } });
    expect(() => {
      project.dispatch({ type: 'screener.setItemProperty', payload: { key: 'q1', property: 'key', value: 'hacked' } });
    }).toThrow(/Cannot set screener item property/);
  });
});

describe('screener.reorderItem', () => {
  it('swaps items', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addItem', payload: { type: 'field', key: 'a', label: 'A' } });
    project.dispatch({ type: 'screener.addItem', payload: { type: 'field', key: 'b', label: 'B' } });
    project.dispatch({ type: 'screener.reorderItem', payload: { index: 0, direction: 'down' } });
    expect((project.state.screener!.items[0] as any).key).toBe('b');
    expect((project.state.screener!.items[1] as any).key).toBe('a');
  });
});

// ── Binds ────────────────────────────────────────────────────────

describe('screener.setBind', () => {
  it('creates a bind when none exists', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.setBind', payload: { path: 'q1', properties: { required: 'true' } } });
    expect(project.state.screener!.binds).toHaveLength(1);
    expect((project.state.screener!.binds![0] as any).required).toBe('true');
  });

  it('null-deletes a bind property', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.setBind', payload: { path: 'q1', properties: { required: 'true', constraint: '$q1 > 0' } } });
    project.dispatch({ type: 'screener.setBind', payload: { path: 'q1', properties: { constraint: null } } });
    const bind = project.state.screener!.binds![0] as any;
    expect(bind.required).toBe('true');
    expect(bind.constraint).toBeUndefined();
  });
});

// ── Phases ───────────────────────────────────────────────────────

describe('screener.addPhase', () => {
  it('adds a phase', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'eligibility', strategy: 'first-match' } });
    expect(project.state.screener!.evaluation).toHaveLength(1);
    expect(project.state.screener!.evaluation[0].id).toBe('eligibility');
    expect(project.state.screener!.evaluation[0].strategy).toBe('first-match');
  });

  it('rejects duplicate phase ID', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'first-match' } });
    expect(() => {
      project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'fan-out' } });
    }).toThrow(/Phase already exists/);
  });
});

describe('screener.removePhase', () => {
  it('removes a phase by id', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'first-match' } });
    project.dispatch({ type: 'screener.removePhase', payload: { phaseId: 'p1' } });
    expect(project.state.screener!.evaluation).toHaveLength(0);
  });

  it('throws for nonexistent phase', () => {
    const project = projectWithScreener();
    expect(() => {
      project.dispatch({ type: 'screener.removePhase', payload: { phaseId: 'nope' } });
    }).toThrow(/Phase not found/);
  });
});

describe('screener.reorderPhase', () => {
  it('swaps phases', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'a', strategy: 'first-match' } });
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'b', strategy: 'fan-out' } });
    project.dispatch({ type: 'screener.reorderPhase', payload: { phaseId: 'a', direction: 'down' } });
    expect(project.state.screener!.evaluation[0].id).toBe('b');
    expect(project.state.screener!.evaluation[1].id).toBe('a');
  });
});

describe('screener.setPhaseProperty', () => {
  it('updates strategy', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'first-match' } });
    project.dispatch({ type: 'screener.setPhaseProperty', payload: { phaseId: 'p1', property: 'strategy', value: 'fan-out' } });
    expect(project.state.screener!.evaluation[0].strategy).toBe('fan-out');
  });

  it('sets activeWhen', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'first-match' } });
    project.dispatch({ type: 'screener.setPhaseProperty', payload: { phaseId: 'p1', property: 'activeWhen', value: '$eligible' } });
    expect(project.state.screener!.evaluation[0].activeWhen).toBe('$eligible');
  });

  it('rejects disallowed properties', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'first-match' } });
    expect(() => {
      project.dispatch({ type: 'screener.setPhaseProperty', payload: { phaseId: 'p1', property: 'id', value: 'hacked' } });
    }).toThrow(/Cannot set phase property/);
  });
});

// ── Routes (phase-scoped) ────────────────────────────────────────

describe('screener.addRoute', () => {
  it('adds a route to a phase', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'first-match' } });
    project.dispatch({
      type: 'screener.addRoute',
      payload: { phaseId: 'p1', route: { condition: 'true', target: 'urn:default' } },
    });
    expect(project.state.screener!.evaluation[0].routes).toHaveLength(1);
    expect(project.state.screener!.evaluation[0].routes[0].target).toBe('urn:default');
  });

  it('throws for nonexistent phase', () => {
    const project = projectWithScreener();
    expect(() => {
      project.dispatch({ type: 'screener.addRoute', payload: { phaseId: 'nope', route: { target: 'x' } } });
    }).toThrow(/Phase not found/);
  });
});

describe('screener.setRouteProperty', () => {
  it('updates a route property', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'first-match' } });
    project.dispatch({ type: 'screener.addRoute', payload: { phaseId: 'p1', route: { condition: 'true', target: 'urn:a' } } });
    project.dispatch({ type: 'screener.setRouteProperty', payload: { phaseId: 'p1', index: 0, property: 'target', value: 'urn:b' } });
    expect(project.state.screener!.evaluation[0].routes[0].target).toBe('urn:b');
  });

  it('supports score, threshold, override, terminal properties', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'score-threshold' } });
    project.dispatch({ type: 'screener.addRoute', payload: { phaseId: 'p1', route: { target: 'urn:a', score: '50', threshold: 25 } } });
    project.dispatch({ type: 'screener.setRouteProperty', payload: { phaseId: 'p1', index: 0, property: 'override', value: true } });
    project.dispatch({ type: 'screener.setRouteProperty', payload: { phaseId: 'p1', index: 0, property: 'terminal', value: true } });
    const route = project.state.screener!.evaluation[0].routes[0];
    expect(route.override).toBe(true);
    expect(route.terminal).toBe(true);
  });

  it('rejects disallowed properties', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'first-match' } });
    project.dispatch({ type: 'screener.addRoute', payload: { phaseId: 'p1', route: { condition: 'true', target: 'urn:a' } } });
    expect(() => {
      project.dispatch({ type: 'screener.setRouteProperty', payload: { phaseId: 'p1', index: 0, property: 'id', value: 'x' } });
    }).toThrow(/Cannot set route property/);
  });
});

describe('screener.deleteRoute', () => {
  it('removes a route from a phase', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'first-match' } });
    project.dispatch({ type: 'screener.addRoute', payload: { phaseId: 'p1', route: { condition: 'true', target: 'urn:a' } } });
    project.dispatch({ type: 'screener.addRoute', payload: { phaseId: 'p1', route: { condition: 'true', target: 'urn:b' } } });
    project.dispatch({ type: 'screener.deleteRoute', payload: { phaseId: 'p1', index: 0 } });
    expect(project.state.screener!.evaluation[0].routes).toHaveLength(1);
    expect(project.state.screener!.evaluation[0].routes[0].target).toBe('urn:b');
  });
});

describe('screener.reorderRoute', () => {
  it('swaps routes within a phase', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'first-match' } });
    project.dispatch({ type: 'screener.addRoute', payload: { phaseId: 'p1', route: { condition: 'true', target: 'urn:a' } } });
    project.dispatch({ type: 'screener.addRoute', payload: { phaseId: 'p1', route: { condition: 'true', target: 'urn:b' } } });
    project.dispatch({ type: 'screener.reorderRoute', payload: { phaseId: 'p1', index: 0, direction: 'down' } });
    expect(project.state.screener!.evaluation[0].routes[0].target).toBe('urn:b');
    expect(project.state.screener!.evaluation[0].routes[1].target).toBe('urn:a');
  });
});

// ── Lifecycle ────────────────────────────────────────────────────

describe('screener.setAvailability', () => {
  it('sets availability window', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.setAvailability', payload: { from: '2026-01-01', until: '2026-12-31' } });
    expect(project.state.screener!.availability).toEqual({ from: '2026-01-01', until: '2026-12-31' });
  });

  it('clears availability', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.setAvailability', payload: { from: '2026-01-01', until: '2026-12-31' } });
    project.dispatch({ type: 'screener.setAvailability', payload: { from: null, until: null } });
    expect(project.state.screener!.availability).toBeUndefined();
  });
});

describe('screener.setResultValidity', () => {
  it('sets result validity', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.setResultValidity', payload: { duration: 'P90D' } });
    expect(project.state.screener!.resultValidity).toBe('P90D');
  });

  it('clears result validity', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.setResultValidity', payload: { duration: 'P90D' } });
    project.dispatch({ type: 'screener.setResultValidity', payload: { duration: null } });
    expect(project.state.screener!.resultValidity).toBeUndefined();
  });
});

// ── Error cases ──────────────────────────────────────────────────

describe('error handling', () => {
  it('throws when no screener is loaded for item operations', () => {
    const project = createRawProject();
    expect(() => {
      project.dispatch({ type: 'screener.addItem', payload: { type: 'field', key: 'q1', label: 'Q1' } });
    }).toThrow(/No screener document loaded/);
  });

  it('throws when no screener is loaded for phase operations', () => {
    const project = createRawProject();
    expect(() => {
      project.dispatch({ type: 'screener.addPhase', payload: { id: 'p1', strategy: 'first-match' } });
    }).toThrow(/No screener document loaded/);
  });

  it('setMetadata throws when no screener loaded', () => {
    const project = createRawProject();
    expect(() => {
      project.dispatch({ type: 'screener.setMetadata', payload: { title: 'New Title' } });
    }).toThrow(/No screener document loaded/);
  });
});

// ── Metadata ─────────────────────────────────────────────────────

describe('screener.setMetadata', () => {
  it('updates title', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.setMetadata', payload: { title: 'Updated' } });
    expect(project.state.screener!.title).toBe('Updated');
  });

  it('updates multiple properties', () => {
    const project = projectWithScreener();
    project.dispatch({ type: 'screener.setMetadata', payload: { title: 'New Title', description: 'A description' } });
    expect(project.state.screener!.title).toBe('New Title');
    expect(project.state.screener!.description).toBe('A description');
  });
});
