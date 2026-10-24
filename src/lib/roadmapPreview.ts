/** Illustrative planning only; never an official school schedule or deadline. */
export function roadmapTimeline(year: number, season: 'winter' | 'summer') {
  const month = season === 'winter' ? 9 : 3;
  const iso = (offset: number) => new Date(Date.UTC(year, month + offset, 1)).toISOString().slice(0, 10);
  return { earlyLanguage: iso(-10), laterLanguage: iso(-8), study: iso(0) };
}

export function applicationPreview(step: number) {
  const completed = Math.max(0, Math.min(4, step));
  return { completed, percent: completed * 25, remaining: 4 - completed };
}

export function shouldCelebrateJourney(armed: boolean, lastBottom: number, viewportHeight: number) {
  return armed && lastBottom > 0 && lastBottom <= viewportHeight * 0.95;
}