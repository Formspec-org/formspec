/** @filedesc Tests for shape-display query module. */
import { describe, it, expect } from 'vitest';
import { describeShapeConstraint } from '../src/queries/shape-display.js';
import type { FormShape } from 'formspec-types';

describe('describeShapeConstraint', () => {
  it('describes a simple constraint shape', () => {
    const shape: FormShape = {
      id: 's1',
      target: 'email',
      constraint: '$email != null',
      message: 'Email is required',
    } as any;

    const result = describeShapeConstraint(shape);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the target path in the description', () => {
    const shape: FormShape = {
      id: 's1',
      target: 'age',
      constraint: '$age > 0',
      message: 'Age must be positive',
    } as any;

    const result = describeShapeConstraint(shape);
    expect(result).toContain('age');
  });

  it('includes the message when present', () => {
    const shape: FormShape = {
      id: 's1',
      target: 'score',
      constraint: '$score >= 0 and $score <= 100',
      message: 'Score must be between 0 and 100',
    } as any;

    const result = describeShapeConstraint(shape);
    expect(result).toContain('Score must be between 0 and 100');
  });

  it('falls back to constraint expression when no message', () => {
    const shape: FormShape = {
      id: 's1',
      target: 'amount',
      constraint: '$amount > 0',
    } as any;

    const result = describeShapeConstraint(shape);
    expect(result).toContain('$amount > 0');
  });

  it('handles shape with severity', () => {
    const shape: FormShape = {
      id: 's1',
      target: 'note',
      constraint: 'string-length($note) > 0',
      message: 'Note should not be empty',
      severity: 'warning',
    } as any;

    const result = describeShapeConstraint(shape);
    expect(result.toLowerCase()).toContain('warning');
  });

  it('handles shape targeting root (#)', () => {
    const shape: FormShape = {
      id: 's1',
      target: '#',
      constraint: '$a != $b',
      message: 'A and B must differ',
    } as any;

    const result = describeShapeConstraint(shape);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles shape with no constraint (composition shape)', () => {
    const shape: FormShape = {
      id: 's1',
      target: 'f1',
      and: ['s2', 's3'],
    } as any;

    const result = describeShapeConstraint(shape);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
