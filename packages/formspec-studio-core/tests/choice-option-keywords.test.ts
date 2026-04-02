import { describe, expect, it } from 'vitest';
import {
  formatCommaSeparatedKeywords,
  parseCommaSeparatedKeywords,
} from '../src/choice-option-keywords.js';

describe('choice option keywords', () => {
  it('parses comma-separated tokens and trims', () => {
    expect(parseCommaSeparatedKeywords('  a , b ,  c ')).toEqual(['a', 'b', 'c']);
  });

  it('returns undefined when empty or whitespace-only', () => {
    expect(parseCommaSeparatedKeywords('')).toBeUndefined();
    expect(parseCommaSeparatedKeywords('  ,  , ')).toBeUndefined();
  });

  it('formats undefined as empty string', () => {
    expect(formatCommaSeparatedKeywords(undefined)).toBe('');
  });

  it('joins with comma-space', () => {
    expect(formatCommaSeparatedKeywords(['CA', 'Calif'])).toBe('CA, Calif');
  });
});
