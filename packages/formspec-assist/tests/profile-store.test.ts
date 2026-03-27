import { describe, expect, it } from 'vitest';
import { ProfileStore } from '../src/profile-store.js';
import type { UserProfile } from '../src/types.js';
import { MemoryStorage } from './helpers.js';

function makeTestProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const now = '2026-03-27T12:00:00.000Z';
  return {
    id: 'test',
    label: 'Test Profile',
    created: now,
    updated: now,
    concepts: {},
    fields: {},
    ...overrides,
  };
}

describe('ProfileStore', () => {
  it('returns undefined when loading from empty storage', () => {
    const store = new ProfileStore(new MemoryStorage());
    expect(store.load('nonexistent')).toBeUndefined();
    expect(store.load()).toBeUndefined();
  });

  it('saves and loads a profile by id', () => {
    const store = new ProfileStore(new MemoryStorage());
    const profile = makeTestProfile();
    store.save(profile);

    expect(store.load('test')).toEqual(profile);
  });

  it('loads the first profile when no id is specified', () => {
    const store = new ProfileStore(new MemoryStorage());
    const first = makeTestProfile({ id: 'first', label: 'First' });
    const second = makeTestProfile({ id: 'second', label: 'Second' });
    store.save(first);
    store.save(second);

    expect(store.load()?.id).toBe('first');
  });

  it('overwrites an existing profile on save', () => {
    const store = new ProfileStore(new MemoryStorage());
    store.save(makeTestProfile({ id: 'test', label: 'Original' }));
    store.save(makeTestProfile({ id: 'test', label: 'Updated' }));

    expect(store.load('test')?.label).toBe('Updated');
    expect(store.listProfiles()).toHaveLength(1);
  });

  it('lists profile summaries', () => {
    const store = new ProfileStore(new MemoryStorage());
    store.save(makeTestProfile({ id: 'a', label: 'Alpha', updated: '2026-01-01T00:00:00Z' }));
    store.save(makeTestProfile({ id: 'b', label: 'Beta', updated: '2026-02-01T00:00:00Z' }));

    const list = store.listProfiles();
    expect(list).toHaveLength(2);
    expect(list).toEqual([
      { id: 'a', label: 'Alpha', updated: '2026-01-01T00:00:00Z' },
      { id: 'b', label: 'Beta', updated: '2026-02-01T00:00:00Z' },
    ]);
  });

  it('deletes a profile by id', () => {
    const store = new ProfileStore(new MemoryStorage());
    store.save(makeTestProfile({ id: 'a' }));
    store.save(makeTestProfile({ id: 'b' }));

    store.deleteProfile('a');
    expect(store.load('a')).toBeUndefined();
    expect(store.listProfiles()).toHaveLength(1);
  });

  it('returns empty array for corrupt JSON in storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('formspec-assist:profiles', '{not valid json');
    const store = new ProfileStore(storage);

    expect(store.load()).toBeUndefined();
    expect(store.listProfiles()).toEqual([]);
  });

  it('returns empty array for non-array JSON in storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('formspec-assist:profiles', '{"not": "an array"}');
    const store = new ProfileStore(storage);

    expect(store.load()).toBeUndefined();
    expect(store.listProfiles()).toEqual([]);
  });

  it('uses default in-memory storage when none is provided', () => {
    const store = new ProfileStore();
    store.save(makeTestProfile());
    expect(store.load('test')).toBeDefined();
  });
});
