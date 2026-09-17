import { describe, expect, it } from 'vitest';
import { MAX_COL_MM, MIN_COL_MM, fitWidths, planColumnGroups } from './tableFit';

describe('fitWidths', () => {
  it('clamps narrow and wide columns into the readable range', () => {
    const out = fitWidths([2, 500], 1000);
    expect(out[0]).toBeGreaterThanOrEqual(MIN_COL_MM);
    expect(out[1]).toBeLessThanOrEqual(MAX_COL_MM * (1000 / (MIN_COL_MM + MAX_COL_MM)) + 0.001);
  });

  it('fills the page when the natural widths are narrower than the paper', () => {
    const out = fitWidths([20, 20, 20], 90);
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(90, 5);
  });

  it('never stretches beyond the page when content is wider', () => {
    const out = fitWidths(Array(19).fill(40), 277);
    expect(Math.max(...out)).toBeLessThanOrEqual(MAX_COL_MM);
  });

  it('returns an empty list for no columns', () => {
    expect(fitWidths([], 277)).toEqual([]);
  });
});

describe('planColumnGroups', () => {
  it('keeps everything in one group when the table fits', () => {
    expect(planColumnGroups([20, 20, 20], 277)).toEqual([[0, 1, 2]]);
  });

  it('splits a wide table and repeats the key column on every group', () => {
    const groups = planColumnGroups(Array(19).fill(40), 277);
    expect(groups.length).toBeGreaterThan(1);
    groups.forEach(g => expect(g[0]).toBe(0));
    // Every column appears exactly once besides the repeated key column.
    const seen = groups.flat().filter(i => i !== 0);
    expect(new Set(seen).size).toBe(18);
    expect(seen.length).toBe(18);
  });

  it('never lets a group exceed the printable width', () => {
    const widths = Array(19).fill(40);
    planColumnGroups(widths, 277).forEach(group => {
      expect(group.reduce((sum, i) => sum + widths[i], 0)).toBeLessThanOrEqual(277);
    });
  });

  it('handles a single column', () => {
    expect(planColumnGroups([40], 277)).toEqual([[0]]);
    expect(planColumnGroups([], 277)).toEqual([]);
  });
});
