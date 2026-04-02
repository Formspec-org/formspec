/** @filedesc Tests for core-owned FEL editor helpers. */
import { describe, expect, it } from 'vitest';
import {
  buildFELHighlightTokens,
  getFELAutocompleteTrigger,
  getFELFunctionAutocompleteTrigger,
  getFELInstanceNameAutocompleteTrigger,
  validateFEL,
} from '../src/fel-editor-utils';

describe('fel-editor-utils', () => {
  describe('getFELAutocompleteTrigger', () => {
    it('triggers on $ at start', () => {
      expect(getFELAutocompleteTrigger('$', 1)).toEqual({
        start: 0,
        end: 1,
        query: '',
        insertionPrefix: '$',
      });
    });

    it('triggers on $ with a partial query', () => {
      expect(getFELAutocompleteTrigger('$foo', 4)).toEqual({
        start: 0,
        end: 4,
        query: 'foo',
        insertionPrefix: '$',
      });
    });

    it('does not trigger after invalid path characters', () => {
      expect(getFELAutocompleteTrigger('$foo!', 5)).toBeNull();
    });

    it('triggers on @instance path access', () => {
      expect(getFELAutocompleteTrigger("@instance('myTab').", 19)).toEqual({
        start: 19,
        end: 19,
        query: '',
        insertionPrefix: '',
        instanceName: 'myTab',
      });
    });

    it('triggers on @instance path access with a query', () => {
      expect(getFELAutocompleteTrigger("@instance('myTab').items", 24)).toEqual({
        start: 19,
        end: 24,
        query: 'items',
        insertionPrefix: '',
        instanceName: 'myTab',
      });
    });
  });

  describe('getFELInstanceNameAutocompleteTrigger', () => {
    it('triggers inside @instance quotes', () => {
      expect(getFELInstanceNameAutocompleteTrigger("@instance('", 11)).toEqual({
        start: 11,
        end: 11,
        query: '',
        insertionSuffix: "')",
      });
    });

    it('triggers inside @instance quotes with a query', () => {
      expect(getFELInstanceNameAutocompleteTrigger("@instance('sa", 13)).toEqual({
        start: 11,
        end: 13,
        query: 'sa',
        insertionSuffix: "')",
      });
    });
  });

  describe('getFELFunctionAutocompleteTrigger', () => {
    it('triggers on bare identifiers', () => {
      expect(getFELFunctionAutocompleteTrigger('su', 2)).toEqual({
        start: 0,
        end: 2,
        query: 'su',
      });
    });

    it('triggers after an operator', () => {
      expect(getFELFunctionAutocompleteTrigger('1 + su', 6)).toEqual({
        start: 4,
        end: 6,
        query: 'su',
      });
    });

    it('does not trigger after a path prefix', () => {
      expect(getFELFunctionAutocompleteTrigger('$su', 3)).toBeNull();
    });
  });

  describe('buildFELHighlightTokens', () => {
    it('classifies function, path, operator, and literal tokens', () => {
      const tokens = buildFELHighlightTokens('sum($val) > 10', { sum: 'sum(array)' });
      const kinds = tokens.map((token) => token.kind);

      expect(kinds).toContain('function');
      expect(kinds).toContain('path');
      expect(kinds).toContain('operator');
      expect(kinds).toContain('literal');
    });

    it('emits full path reference as a single path token', () => {
      const tokens = buildFELHighlightTokens('$field > 10');
      const pathTokens = tokens.filter((t) => t.kind === 'path');
      expect(pathTokens).toHaveLength(1);
      expect(pathTokens[0].text).toBe('$field');
    });

    it('emits dotted path as a single path token', () => {
      const tokens = buildFELHighlightTokens('$group.field = true');
      const pathTokens = tokens.filter((t) => t.kind === 'path');
      expect(pathTokens).toHaveLength(1);
      expect(pathTokens[0].text).toBe('$group.field');
    });

    it('emits bracketed wildcard path as a single path token', () => {
      const tokens = buildFELHighlightTokens('sum($members[*].mInc)', { sum: 'sum(array)' });
      const pathTokens = tokens.filter((t) => t.kind === 'path');
      expect(pathTokens).toHaveLength(1);
      expect(pathTokens[0].text).toBe('$members[*].mInc');
    });

    it('emits variable reference as a single path token', () => {
      const tokens = buildFELHighlightTokens('@incLimit + 100');
      const pathTokens = tokens.filter((t) => t.kind === 'path');
      expect(pathTokens).toHaveLength(1);
      expect(pathTokens[0].text).toBe('@incLimit');
    });

    it('handles multiple path references in one expression', () => {
      const tokens = buildFELHighlightTokens('$a + $b.c');
      const pathTokens = tokens.filter((t) => t.kind === 'path');
      expect(pathTokens).toHaveLength(2);
      expect(pathTokens[0].text).toBe('$a');
      expect(pathTokens[1].text).toBe('$b.c');
    });

    it('does not merge path tokens across whitespace', () => {
      const tokens = buildFELHighlightTokens('$a + $b');
      const pathTokens = tokens.filter((t) => t.kind === 'path');
      expect(pathTokens).toHaveLength(2);
      expect(pathTokens[0].text).toBe('$a');
      expect(pathTokens[1].text).toBe('$b');
    });
  });

  describe('validateFEL', () => {
    it('returns null for valid expressions', () => {
      expect(validateFEL('1 + 2')).toBeNull();
      expect(validateFEL('$foo > 10')).toBeNull();
    });

    it('returns a formatted error for invalid expressions', () => {
      const error = validateFEL('1 + ');
      expect(error).not.toBeNull();
      expect(error).toMatch(/line 1, column 1:/i);
    });
  });
});
