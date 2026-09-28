/**
 * Appointment reminder content — the single source of truth for the title,
 * body, priority, deep link and push tag of the 24h / 1h / 15m reminders.
 *
 * Deliberately dependency-free (no Deno globals) so BOTH the edge worker
 * (`send-appointment-reminders`) and the vitest suite can import it directly —
 * there is no duplicated content builder to drift.
 *
 * Times are rendered in the office timezone (`Asia/Jerusalem`) with Western
 * numerals, matching the rest of the app (Arabic screens never show
 * Arabic-Indic digits).
 */

export type ReminderKind = "t_24h" | "t_1h" | "t_15m";

/**
 * `time_sensitive` is the dedicated appointment-starting-soon level. It is
 * intentionally NOT the generic `high`: the service worker routes it to a
 * distinct, persistent treatment (and never to the voice-call ring), and the
 * push dispatcher treats it as urgent.
 */
export type ReminderPriority = "medium" | "high" | "time_sensitive";

export interface ReminderAppointmentInput {
  /** Appointment id — anchors the deep link and the per-appointment push tag. */
  id: string;
  /** ISO timestamp of the appointment start. */
  scheduledAt: string;
  durationMinutes: number;
  studentName?: string | null;
  caseReference?: string | null;
  /** Resolved office display name, when the appointment is at a DARB office. */
  officeName?: string | null;
}

export interface ReminderContent {
  kind: ReminderKind;
  priority: ReminderPriority;
  /** Whether this window also sends an email (the 15m alert is push-only). */
  email: boolean;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  link: string;
  tag: string;
}

const TIME_ZONE = "Asia/Jerusalem";

/** Window suffix used inside notification tags (`appointment:<id>:15m`). */
const WINDOW: Record<ReminderKind, string> = {
  t_24h: "24h",
  t_1h: "1h",
  t_15m: "15m",
};

const LABELS: Record<ReminderKind, { en: string; ar: string; priority: ReminderPriority; email: boolean }> = {
  t_24h: { en: "Appointment tomorrow", ar: "لديك موعد غداً", priority: "medium", email: true },
  t_1h: { en: "Appointment in 1 hour", ar: "موعدك بعد ساعة", priority: "high", email: true },
  t_15m: {
    en: "Appointment starting soon",
    ar: "موعدك يبدأ بعد 15 دقيقة",
    priority: "time_sensitive",
    email: false,
  },
};

function dateParts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    ...options,
    // Force a 24-hour clock so the string is identical in every runtime locale.
    hour12: false,
  }).formatToParts(date);
  const out: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out;
}

/** `HH:MM` (24-hour) in the office timezone. */
function clock(date: Date): string {
  const p = dateParts(date, { hour: "2-digit", minute: "2-digit" });
  return `${p.hour}:${p.minute}`;
}

/** `11:15–12:30` — start to end, derived from the duration. */
export function formatTimeRange(scheduledAt: string, durationMinutes: number): string {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + Math.max(0, durationMinutes) * 60_000);
  return `${clock(start)}–${clock(end)}`;
}

/** `Wed 8 Oct` — the appointment date, only useful on the 24h reminder. */
export function formatShortDate(scheduledAt: string): string {
  const p = dateParts(new Date(scheduledAt), { weekday: "short", day: "numeric", month: "short" });
  return `${p.weekday} ${p.day} ${p.month}`;
}

/**
 * A per-appointment tag, so the reminder for one appointment never replaces the
 * reminder for another. The window suffix keeps the 24h/1h/15m alerts distinct
 * while still being grouped per appointment by the OS.
 */
export function reminderTag(appointmentId: string, kind: ReminderKind): string {
  return `appointment:${appointmentId}:${WINDOW[kind]}`;
}

export function reminderLink(appointmentId: string): string {
  return `/team/appointments?appointment=${appointmentId}`;
}

/**
 * Extract the appointment id from a reminder deep link, so the push dispatcher
 * can rebuild the same per-appointment tag from the stored notification row
 * without a schema change.
 */
export function appointmentIdFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const match = /[?&]appointment=([0-9a-fA-F-]{8,})/.exec(link);
  return match ? match[1] : null;
}

/**
 * The tag for a notification about to be pushed. Appointment reminders get a
 * per-appointment identity (so two different appointments never replace each
 * other); everything else keeps the existing `category:caseOrNotification` tag.
 */
export function pushTag(input: {
  category: string | null | undefined;
  link: string | null | undefined;
  caseId: string | null | undefined;
  notificationId: string;
  priority: string;
}): string {
  if ((input.category ?? "") === "appointments") {
    const appointmentId = appointmentIdFromLink(input.link);
    if (appointmentId) return `appointment:${appointmentId}:${input.priority}`;
  }
  return `${input.category ?? "system"}:${input.caseId ?? input.notificationId}`;
}

export function buildReminderContent(
  kind: ReminderKind,
  appointment: ReminderAppointmentInput,
): ReminderContent {
  const label = LABELS[kind];
  const person = appointment.studentName || appointment.caseReference || "";
  const timeRange = formatTimeRange(appointment.scheduledAt, appointment.durationMinutes);
  const when = kind === "t_24h" ? `${formatShortDate(appointment.scheduledAt)} ${timeRange}` : timeRange;
  const office = appointment.officeName ? ` · ${appointment.officeName}` : "";
  const body = person ? `${person} · ${when}${office}` : `${when}${office}`;

  return {
    kind,
    priority: label.priority,
    email: label.email,
    titleEn: label.en,
    titleAr: label.ar,
    bodyEn: body,
    bodyAr: body,
    link: reminderLink(appointment.id),
    tag: reminderTag(appointment.id, kind),
  };
}
