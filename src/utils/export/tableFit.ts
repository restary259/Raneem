/**
 * Column fitting for PDF tables.
 *
 * jsPDF-autotable honours the widths it is given: if the columns add up to
 * more than the printable area it simply draws the surplus columns off the
 * paper (they vanish). These pure helpers make that impossible — widths are
 * clamped into a readable range and, when a table is still too wide, the
 * columns are split into continuation groups so every column is printed
 * somewhere instead of being clipped.
 */

/** Narrowest a column may be squeezed to before it stops being readable (mm). */
export const MIN_COL_MM = 14;
/** Widest a single column may claim; longer text wraps instead (mm). */
export const MAX_COL_MM = 46;

/**
 * Clamps natural (measured) column widths into the readable range and, when
 * there is spare room on the page, distributes it proportionally so the table
 * fills the paper instead of hugging the left margin.
 */
export function fitWidths(
  natural: number[],
  available: number,
  min = MIN_COL_MM,
  max = MAX_COL_MM,
): number[] {
  if (!natural.length) return [];
  const clamped = natural.map(w => Math.min(Math.max(w, min), max));
  const total = clamped.reduce((a, b) => a + b, 0);
  if (total >= available || total <= 0) return clamped;
  const factor = available / total;
  return clamped.map(w => w * factor);
}

/**
 * Splits columns into groups that each fit inside `available`.
 *
 * Every group after the first repeats the key column (the row identifier) so a
 * continuation page can still be matched back to its row. A column that is
 * wider than the page on its own gets a group to itself rather than being
 * dropped.
 */
export function planColumnGroups(
  widths: number[],
  available: number,
  keyIndex = 0,
): number[][] {
  if (!widths.length) return [];
  const total = widths.reduce((a, b) => a + b, 0);
  if (total <= available) return [widths.map((_, i) => i)];

  const keyWidth = widths[keyIndex] ?? 0;
  const groups: number[][] = [];
  let current: number[] = [];
  let used = 0;

  for (let i = 0; i < widths.length; i++) {
    if (groups.length > 0 && i === keyIndex) continue; // already repeated per group
    if (current.length && used + widths[i] > available) {
      groups.push(current);
      current = [];
      used = 0;
    }
    if (!current.length && groups.length > 0 && i !== keyIndex) {
      current.push(keyIndex);
      used += keyWidth;
    }
    current.push(i);
    used += widths[i];
  }
  if (current.length) groups.push(current);
  return groups;
}
