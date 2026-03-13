import { describe, it, expect } from 'vitest';
import { 
  getFELAutocompleteTrigger, 
  getFELInstanceNameAutocompleteTrigger, 
  getFELFunctionAutocompleteTrigger,
  buildFELHighlightTokens,
  validateFEL
} from '../../src/lib/fel-editor-utils';

describe('fel-editor-utils', () => {
  describe('getFELAutocompleteTrigger', () => {
    it('should trigger on $ at start', () => {
      const result = getFELAutocompleteTrigger('$', 1);
      expect(result).toEqual({
        start: 0,
        end: 1,
        query: '',
        insertionPrefix: '$'
      });
    });

    it('should trigger on $ with partial query', () => {
      const result = getFELAutocompleteTrigger('$foo', 4);
      expect(result).toEqual({
        start: 0,
        end: 4,
        query: 'foo',
        insertionPrefix: '$'
      });
    });

    it('should not trigger on $ followed by invalid chars', () => {
      const result = getFELAutocompleteTrigger('$foo!', 5);
      expect(result).toBeNull();
    });

    it('should trigger on @instance path', () => {
      const result = getFELAutocompleteTrigger("@instance('myTab').", 19);
      expect(result).toEqual({
        start: 19,
        end: 19,
        query: '',
        insertionPrefix: '',
        instanceName: 'myTab'
      });
    });

    it('should trigger on @instance path with query', () => {
      const result = getFELAutocompleteTrigger("@instance('myTab').items", 24);
      expect(result).toEqual({
        start: 19,
        end: 24,
        query: 'items',
        insertionPrefix: '',
        instanceName: 'myTab'
      });
    });
  });

  describe('getFELInstanceNameAutocompleteTrigger', () => {
    it('should trigger inside @instance quotes', () => {
      const result = getFELInstanceNameAutocompleteTrigger("@instance('", 11);
      expect(result).toEqual({
        start: 11,
        end: 11,
        query: '',
        insertionSuffix: "')"
      });
    });

    it('should trigger inside @instance quotes with query', () => {
      const result = getFELInstanceNameAutocompleteTrigger("@instance('sa", 13);
      expect(result).toEqual({
        start: 11,
        end: 13,
        query: 'sa',
        insertionSuffix: "')"
      });
    });
  });

  describe('getFELFunctionAutocompleteTrigger', () => {
    it('should trigger on identifier', () => {
      const result = getFELFunctionAutocompleteTrigger('su', 2);
      expect(result).toEqual({
        start: 0,
        end: 2,
        query: 'su'
      });
    });

    it('should trigger after space', () => {
      const result = getFELFunctionAutocompleteTrigger('1 + su', 6);
      expect(result).toEqual({
        start: 4,
        end: 6,
        query: 'su'
      });
    });

    it('should not trigger if preceded by $', () => {
      const result = getFELFunctionAutocompleteTrigger('$su', 3);
      expect(result).toBeNull();
    });
  });

  describe('buildFELHighlightTokens', () => {
    it('should identify tokens correctly', () => {
      const tokens = buildFELHighlightTokens('sum($val) > 10', { 'sum': 'sum(array)' });
      
      const kinds = tokens.map(t => t.kind);
      expect(kinds).toContain('function');
      expect(kinds).toContain('path');
      expect(kinds).toContain('operator');
      expect(kinds).toContain('literal');
    });
  });

  describe('validateFEL', () => {
    it('should return null for valid expression', () => {
      expect(validateFEL('1 + 2')).toBeNull();
      expect(validateFEL('$foo > 10')).toBeNull();
    });

    it('should return error message for invalid expression', () => {
      const error = validateFEL('1 + ');
      expect(error).not.toBeNull();
      expect(error).toContain('Expecting:');
    });
  });
});
