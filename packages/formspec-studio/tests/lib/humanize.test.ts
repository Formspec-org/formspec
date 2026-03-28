import { describe, it, expect } from 'vitest';
import { humanizeFEL } from '@formspec-org/studio-core';

describe('humanizeFEL', () => {
  it('translates equality comparison', () => {
    expect(humanizeFEL('$evHist = true')).toBe('Ev Hist is Yes');
  });

  it('translates not-equal comparison', () => {
    expect(humanizeFEL('$status != "active"')).toBe('Status is not "active"');
  });

  it('translates numeric comparison', () => {
    expect(humanizeFEL('$age >= 18')).toBe('Age is at least 18');
  });

  it('translates less-than comparison', () => {
    expect(humanizeFEL('$score < 50')).toBe('Score is less than 50');
  });

  it('translates boolean true reference', () => {
    expect(humanizeFEL('$isActive = true')).toBe('Is Active is Yes');
  });

  it('translates boolean false reference', () => {
    expect(humanizeFEL('$isActive = false')).toBe('Is Active is No');
  });

  it('returns raw expression for complex FEL', () => {
    const expr = 'if($a > 1, $b + $c, $d)';
    expect(humanizeFEL(expr)).toBe(expr);
  });

  it('returns raw expression for function calls', () => {
    const expr = 'count($items)';
    expect(humanizeFEL(expr)).toBe(expr);
  });
});
