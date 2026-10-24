import { describe, expect, it } from 'vitest';
import { applicationPreview, roadmapTimeline, shouldCelebrateJourney } from './roadmapPreview';

describe('HTML roadmap interactions', () => {
  it('has four application steps with 25 percent per completed step', () => {
    expect(applicationPreview(2)).toEqual({ completed: 2, percent: 50, remaining: 2 });
    expect(applicationPreview(4)).toEqual({ completed: 4, percent: 100, remaining: 0 });
  });
  it('plans language eight to ten months before the illustrative winter start', () => {
    expect(roadmapTimeline(2027, 'winter')).toEqual({ earlyLanguage: '2026-12-01', laterLanguage: '2027-02-01', study: '2027-10-01' });
  });
  it('handles the previous calendar year for the summer illustration', () => {
    expect(roadmapTimeline(2027, 'summer')).toEqual({ earlyLanguage: '2026-06-01', laterLanguage: '2026-08-01', study: '2027-04-01' });
  });
  it('celebrates automatically only after scrolling through the last station', () => {
    expect(shouldCelebrateJourney(true, 800, 1000)).toBe(true);
    expect(shouldCelebrateJourney(false, 800, 1000)).toBe(false);
    expect(shouldCelebrateJourney(true, 960, 1000)).toBe(false);
    expect(shouldCelebrateJourney(true, -10, 1000)).toBe(false);
  });
});