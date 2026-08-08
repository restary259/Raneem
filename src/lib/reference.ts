/**
 * Human-readable record references (`DRB-2026-000042`, `PAY-2026-000017`).
 *
 * Search must be forgiving: the number is read off a screen, written on paper
 * and typed back with or without the prefix, dashes or spaces.
 */

/** Upper-cases and strips every separator so two spellings compare equal. */
export const normalizeRef = (input: string | null | undefined): string =>
  (input ?? '').toUpperCase().replace(/[\s\-_/.]/g, '');

/**
 * True when `query` looks like part of `ref`. Also matches a bare number
 * (`17`, `000017`) against the numeric tail of the reference.
 */
export const matchesRef = (ref: string | null | undefined, query: string): boolean => {
  const q = normalizeRef(query);
  if (!q) return true;
  const r = normalizeRef(ref);
  if (!r) return false;
  if (r.includes(q)) return true;

  // Bare digits: compare against the sequence part, ignoring leading zeros.
  if (/^\d+$/.test(q)) {
    const tail = r.match(/(\d+)$/)?.[1] ?? '';
    if (tail.replace(/^0+/, '') === q.replace(/^0+/, '')) return true;
  }
  return false;
};
