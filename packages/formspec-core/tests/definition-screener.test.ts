import { describe, it, expect } from 'vitest';
import { createRawProject } from '../src/index.js';

describe('definition.setScreener', () => {
  it('creates an empty screener when enabled', () => {
    const project = createRawProject();

    project.dispatch({
      type: 'definition.setScreener',
      payload: { enabled: true },
    });

    expect(project.definition.screener).toBeDefined();
    expect(project.definition.screener!.items).toEqual([]);
    expect(project.definition.screener!.routes).toEqual([]);
  });

  it('deletes the screener object when disabled', () => {
    const project = createRawProject();

    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age', dataType: 'integer' },
    });
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: false } });

    expect(project.definition.screener).toBeUndefined();
  });

  it('re-enabling after disable creates a fresh empty screener', () => {
    const project = createRawProject();

    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age', dataType: 'integer' },
    });
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: false } });
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    expect(project.definition.screener).toBeDefined();
    expect(project.definition.screener!.items).toEqual([]);
  });

  it('is a no-op when enabling an already active screener', () => {
    const project = createRawProject();

    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age', dataType: 'integer' },
    });
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    expect(project.definition.screener!.items).toHaveLength(1);
  });
});

describe('definition.addScreenerItem', () => {
  it('adds a field to the screener scope', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age', label: 'Age', dataType: 'integer' },
    });

    expect(project.definition.screener!.items).toHaveLength(1);
    expect(project.definition.screener!.items[0].key).toBe('age');
    expect(project.definition.screener!.items[0].label).toBe('Age');
  });

  it('rejects mutations when no screener exists', () => {
    const project = createRawProject();

    expect(() => {
      project.dispatch({
        type: 'definition.addScreenerItem',
        payload: { type: 'field', key: 'age', dataType: 'integer' },
      });
    }).toThrow(/not enabled/i);
  });
});

describe('definition.deleteScreenerItem', () => {
  it('removes a screener item by key', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age' },
    });
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'gender' },
    });

    project.dispatch({
      type: 'definition.deleteScreenerItem',
      payload: { key: 'age' },
    });

    expect(project.definition.screener!.items).toHaveLength(1);
    expect(project.definition.screener!.items[0].key).toBe('gender');
  });

  it('cleans up screener binds referencing deleted item', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'age' },
    });
    project.dispatch({
      type: 'definition.setScreenerBind',
      payload: { path: 'age', properties: { required:  'true' } },
    });

    project.dispatch({
      type: 'definition.deleteScreenerItem',
      payload: { key: 'age' },
    });

    expect(project.definition.screener!.binds ?? []).toHaveLength(0);
  });
});

describe('definition.setScreenerBind', () => {
  it('sets a bind on a screener item', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key: 'eligible' },
    });

    project.dispatch({
      type: 'definition.setScreenerBind',
      payload: { path: 'eligible', properties: { required:  'true', constraint: '$eligible != ""' } },
    });

    const bind = project.definition.screener!.binds!.find((b: any) => b.path === 'eligible');
    expect(bind).toBeDefined();
    expect(bind!.required).toBe( 'true');
    expect(bind!.constraint).toBe('$eligible != ""');
  });
});

describe('definition.addRoute', () => {
  it('appends a route', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    project.dispatch({
      type: 'definition.addRoute',
      payload: { condition: '$age >= 18', target: 'urn:formspec:adult-form', label: 'Adult' },
    });

    expect(project.definition.screener!.routes).toHaveLength(1);
    expect(project.definition.screener!.routes[0].condition).toBe('$age >= 18');
    expect(project.definition.screener!.routes[0].target).toBe('urn:formspec:adult-form');
    expect(project.definition.screener!.routes[0].label).toBe('Adult');
  });

  it('stores a rejection message on a route', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    project.dispatch({
      type: 'definition.addRoute',
      payload: {
        condition: '$age < 18',
        target: 'urn:formspec:reject',
        message: 'Thank you for your interest. This study requires participants aged 18 or older.',
      },
    });

    expect(project.definition.screener!.routes[0].message).toBe(
      'Thank you for your interest. This study requires participants aged 18 or older.',
    );
  });

  it('omits message when not provided', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });

    project.dispatch({
      type: 'definition.addRoute',
      payload: { condition: '$x', target: 'urn:x' },
    });

    expect(project.definition.screener!.routes[0].message).toBeUndefined();
  });

  it('inserts at a specific index', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addRoute',
      payload: { condition: '$a', target: 'urn:a' },
    });
    project.dispatch({
      type: 'definition.addRoute',
      payload: { condition: '$c', target: 'urn:c' },
    });

    project.dispatch({
      type: 'definition.addRoute',
      payload: { condition: '$b', target: 'urn:b', insertIndex: 1 },
    });

    expect(project.definition.screener!.routes[1].condition).toBe('$b');
  });
});

describe('definition.setRouteProperty', () => {
  it('updates a route property', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addRoute',
      payload: { condition: '$x', target: 'urn:x' },
    });

    project.dispatch({
      type: 'definition.setRouteProperty',
      payload: { index: 0, property: 'label', value: 'Updated Label' },
    });

    expect(project.definition.screener!.routes[0].label).toBe('Updated Label');
  });

  it('updates a route message', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({
      type: 'definition.addRoute',
      payload: { condition: '$x', target: 'urn:x', message: 'Original' },
    });

    project.dispatch({
      type: 'definition.setRouteProperty',
      payload: { index: 0, property: 'message', value: 'Updated rejection message' },
    });

    expect(project.definition.screener!.routes[0].message).toBe('Updated rejection message');
  });

  it('deletes the property when value is undefined', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addRoute', payload: { condition: '$x', target: 'urn:x', label: 'My Rule' } });

    project.dispatch({ type: 'definition.setRouteProperty', payload: { index: 0, property: 'label', value: undefined } });

    expect('label' in project.definition.screener!.routes[0]).toBe(false);
  });

  it('deletes the property when value is null', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addRoute', payload: { condition: '$x', target: 'urn:x', message: 'Hello' } });

    project.dispatch({ type: 'definition.setRouteProperty', payload: { index: 0, property: 'message', value: null } });

    expect('message' in project.definition.screener!.routes[0]).toBe(false);
  });
});

describe('definition.deleteRoute', () => {
  it('removes a route by index', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addRoute', payload: { condition: '$a', target: 'urn:a' } });
    project.dispatch({ type: 'definition.addRoute', payload: { condition: '$b', target: 'urn:b' } });

    project.dispatch({ type: 'definition.deleteRoute', payload: { index: 0 } });

    expect(project.definition.screener!.routes).toHaveLength(1);
    expect(project.definition.screener!.routes[0].condition).toBe('$b');
  });

  it('throws when deleting the last route', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addRoute', payload: { condition: '$x', target: 'urn:x' } });

    expect(() => {
      project.dispatch({ type: 'definition.deleteRoute', payload: { index: 0 } });
    }).toThrow();
  });
});

describe('definition.setScreenerItemProperty', () => {
  it('updates a property on a screener item', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addScreenerItem', payload: { type: 'field', key: 'age', label: 'Age' } });
    project.dispatch({ type: 'definition.setScreenerItemProperty', payload: { key: 'age', property: 'label', value: 'Your age' } });
    expect(project.definition.screener!.items[0].label).toBe('Your age');
  });

  it('deletes the property when value is undefined', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addScreenerItem', payload: { type: 'field', key: 'age', label: 'Age', helpText: 'Enter your age' } });
    project.dispatch({ type: 'definition.setScreenerItemProperty', payload: { key: 'age', property: 'helpText', value: undefined } });
    expect('helpText' in project.definition.screener!.items[0]).toBe(false);
  });

  it('throws for unknown key', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    expect(() => {
      project.dispatch({ type: 'definition.setScreenerItemProperty', payload: { key: 'nope', property: 'label', value: 'x' } });
    }).toThrow(/not found/i);
  });

  it('rejects non-whitelisted properties', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addScreenerItem', payload: { type: 'field', key: 'age', label: 'Age' } });
    expect(() => {
      project.dispatch({ type: 'definition.setScreenerItemProperty', payload: { key: 'age', property: 'key', value: 'newkey' } });
    }).toThrow(/cannot set/i);
  });
});

describe('definition.reorderScreenerItem', () => {
  it('swaps items by direction', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addScreenerItem', payload: { type: 'field', key: 'a', label: 'A' } });
    project.dispatch({ type: 'definition.addScreenerItem', payload: { type: 'field', key: 'b', label: 'B' } });
    project.dispatch({ type: 'definition.reorderScreenerItem', payload: { index: 0, direction: 'down' } });
    expect(project.definition.screener!.items[0].key).toBe('b');
    expect(project.definition.screener!.items[1].key).toBe('a');
  });

  it('is a no-op at boundaries', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addScreenerItem', payload: { type: 'field', key: 'a', label: 'A' } });
    project.dispatch({ type: 'definition.reorderScreenerItem', payload: { index: 0, direction: 'up' } });
    expect(project.definition.screener!.items[0].key).toBe('a');
  });
});

describe('definition.reorderRoute', () => {
  it('swaps routes by direction', () => {
    const project = createRawProject();
    project.dispatch({ type: 'definition.setScreener', payload: { enabled: true } });
    project.dispatch({ type: 'definition.addRoute', payload: { condition: '$a', target: 'urn:a' } });
    project.dispatch({ type: 'definition.addRoute', payload: { condition: '$b', target: 'urn:b' } });

    project.dispatch({
      type: 'definition.reorderRoute',
      payload: { index: 0, direction: 'down' },
    });

    expect(project.definition.screener!.routes[0].condition).toBe('$b');
    expect(project.definition.screener!.routes[1].condition).toBe('$a');
  });
});
