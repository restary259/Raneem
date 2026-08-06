/**
 * Darb corporate export theme.
 * Single source of truth for every generated Excel / PDF report.
 */

export const BRAND = {
  company: 'Darb Study International',
  companyAr: 'درب للدراسة الدولية',
  confidentiality: 'Confidential — for the intended recipient only',
  timeZone: 'Asia/Jerusalem',
};

/** ARGB colors (ExcelJS format). */
export const COLORS = {
  navy: 'FF1E3A5F',
  navyDark: 'FF152C48',
  gold: 'FFC9A227',
  white: 'FFFFFFFF',
  text: 'FF1F2933',
  muted: 'FF6B7280',
  zebra: 'FFF5F7FA',
  border: 'FFD9DEE5',
  borderStrong: 'FF9AA5B1',
  totalFill: 'FFEDF1F6',
  positive: 'FF12805C',
  negative: 'FFB4232C',
};

/** Subtle status tints: [fill, font]. */
export const STATUS_TINTS: Record<'success' | 'warning' | 'danger' | 'info' | 'neutral', { fill: string; font: string }> = {
  success: { fill: 'FFE3F5EC', font: 'FF12805C' },
  warning: { fill: 'FFFDF3DC', font: 'FF8A6100' },
  danger: { fill: 'FFFCE7E8', font: 'FFB4232C' },
  info: { fill: 'FFE7EEF8', font: 'FF1E3A5F' },
  neutral: { fill: 'FFF1F3F5', font: 'FF4B5563' },
};

/** Maps a raw status token to a tone. Unknown tokens stay neutral. */
const TONE_BY_TOKEN: Record<string, keyof typeof STATUS_TINTS> = {
  paid: 'success',
  enrollment_paid: 'success',
  approved: 'success',
  completed: 'success',
  enrolled: 'success',
  active: 'success',
  accepted: 'success',
  eligible: 'success',
  received: 'success',
  pending: 'warning',
  requested: 'warning',
  processing: 'warning',
  in_review: 'warning',
  submitted: 'warning',
  appointment: 'warning',
  locked: 'warning',
  rejected: 'danger',
  cancelled: 'danger',
  failed: 'danger',
  not_eligible: 'danger',
  overdue: 'danger',
  inactive: 'neutral',
  new: 'info',
  contacted: 'info',
  assigned: 'info',
  profile: 'info',
};

export function statusTone(raw: unknown): keyof typeof STATUS_TINTS {
  const key = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  return TONE_BY_TOKEN[key] ?? 'neutral';
}

export const FONTS = {
  family: 'Calibri',
  titleSize: 16,
  subtitleSize: 10,
  headerSize: 11,
  bodySize: 11,
};

export const LAYOUT = {
  minColWidth: 10,
  maxColWidth: 45,
  titleRowHeight: 24,
  headerRowHeight: 22,
  bodyRowHeight: 18,
  /** Columns above this count switch the printout to landscape. */
  landscapeThreshold: 7,
};

export const thinBorder = {
  top: { style: 'thin' as const, color: { argb: COLORS.border } },
  left: { style: 'thin' as const, color: { argb: COLORS.border } },
  bottom: { style: 'thin' as const, color: { argb: COLORS.border } },
  right: { style: 'thin' as const, color: { argb: COLORS.border } },
};
