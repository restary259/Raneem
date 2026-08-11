/**
 * Pure derivation of the "needs attention now" task list for a case.
 * Everything here is computed from data the case page already loaded —
 * no queries, no side effects — so it can be unit tested directly.
 */

export type CaseTaskAction = "upload_document" | "schedule_appointment" | "record_outcome" | "add_note";

export interface CaseTask {
  id: string;
  /** i18n key under dashboard:case.tasks */
  labelKey: string;
  /** interpolation values for the label */
  values?: Record<string, string | number>;
  action: CaseTaskAction;
  /** target appointment when the action needs one */
  appointmentId?: string;
  /** lower = more blocking */
  priority: number;
}

export interface CaseTaskInput {
  status: string;
  lastActivityAt: string | null;
  submission: {
    payment_confirmed?: boolean | null;
    payment_confirmed_at?: string | null;
    profile_completed_at?: string | null;
  } | null;
  documents: { category: string }[];
  appointments: { id: string; scheduled_at: string; outcome: string | null }[];
  /** days of silence before a case counts as neglected */
  forgottenDays: number;
  now?: number;
}

/**
 * Document categories a case cannot progress without.
 * Empty on purpose: passport and identity details are collected during the
 * profile completion step, so re-asking for an upload here is redundant.
 */
export const REQUIRED_DOCUMENT_CATEGORIES: readonly string[] = [];

/** Stages where an appointment is expected to exist. */
const STAGES_EXPECTING_APPOINTMENT = ["contacted", "appointment_scheduled"];

const DAY_MS = 86_400_000;

function daysSince(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS));
}

export function deriveCaseTasks(input: CaseTaskInput): CaseTask[] {
  const now = input.now ?? Date.now();
  const tasks: CaseTask[] = [];
  const terminal = input.status === "cancelled" || input.status === "enrollment_paid";

  // 1. Appointment past its slot with no outcome recorded.
  const staleAppt = input.appointments
    .filter((a) => !a.outcome && new Date(a.scheduled_at).getTime() < now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
  if (staleAppt && !terminal) {
    tasks.push({
      id: `outcome:${staleAppt.id}`,
      labelKey: "case.tasks.outcomeMissing",
      values: {
        date: new Date(staleAppt.scheduled_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      },
      action: "record_outcome",
      appointmentId: staleAppt.id,
      priority: 2,
    });
  }

  // 2. No appointment at all while the stage expects one.
  if (!terminal && STAGES_EXPECTING_APPOINTMENT.includes(input.status) && input.appointments.length === 0) {
    tasks.push({
      id: "appointment",
      labelKey: "case.tasks.noAppointment",
      action: "schedule_appointment",
      priority: 3,
    });
  }

  // 3. Required documents still missing.
  if (!terminal) {
    const present = new Set(input.documents.map((d) => d.category));
    for (const category of REQUIRED_DOCUMENT_CATEGORIES) {
      if (!present.has(category)) {
        tasks.push({
          id: `document:${category}`,
          labelKey: `case.tasks.documentMissing.${category}`,
          action: "upload_document",
          priority: 4,
        });
      }
    }
  }

  // 4. Nothing logged for longer than the configured threshold.
  const silentDays = daysSince(input.lastActivityAt, now);
  if (!terminal && input.forgottenDays > 0 && silentDays >= input.forgottenDays) {
    tasks.push({
      id: "silence",
      labelKey: "case.tasks.noFollowUp",
      values: { days: silentDays },
      action: "add_note",
      priority: 5,
    });
  }

  return tasks.sort((a, b) => a.priority - b.priority);
}
