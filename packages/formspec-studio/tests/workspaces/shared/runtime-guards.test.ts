import { describe, expect, it } from 'vitest';
import { isPlainObject, isRecord } from '../../../src/workspaces/shared/runtime-guards';

describe('isRecord', () => {
  it('accepts plain objects and arrays', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('rejects null and primitives', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord(0)).toBe(false);
    expect(isRecord('')).toBe(false);
  });
});

describe('isPlainObject', () => {
  it('accepts only non-array objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it('rejects arrays', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject([1])).toBe(false);
  });

  it('rejects null and primitives', () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
  });
});
