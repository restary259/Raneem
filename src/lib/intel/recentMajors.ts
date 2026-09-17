/**
 * Recently opened majors, remembered per device for the team desk.
 * Ids only — never student data.
 */
const KEY = 'darb:intel:recent-majors';
const LIMIT = 5;

export function readRecentMajors(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function pushRecentMajor(id: string): string[] {
  const next = [id, ...readRecentMajors().filter((item) => item !== id)].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recents are a convenience only */
  }
  return next;
}
