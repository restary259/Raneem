import { CaseStatus, isTerminalStatus, resolveStatus } from './caseStatus';

/**
 * Centralized SLA policy for case handling.
 *
 * This is the single place that decides how stale a case must be before it
 * is considered an SLA breach. Dashboards consume these helpers instead of
 * re-implementing the thresholds.
 *
 * Note: the `new` and `contacted` thresholds mirror the runtime settings
 * `platform_settings.forgotten_new_case_days` / `forgotten_contacted_days`
 * (defaults 3 / 5). The remaining stages have no runtime setting yet, so
 * their thresholds are constants here. If those become configurable in the
 * future, only this module needs to change.
 */
export const SLA_DAYS: Record<string, number> = {
  [CaseStatus.NEW]: 3,
  [CaseStatus.CONTACTED]: 5,
  [CaseStatus.APPT_SCHEDULED]: 14,
  [CaseStatus.PROFILE_COMPLETION]: 7,
};

const DAY_MS = 86_400_000;

/** Returns the date a case becomes an SLA breach, or null when no SLA applies. */
export function getSlaDueAt(status: string, lastActivityAt?: string | null): Date | null {
  const resolved = resolveStatus(status);
  const days = SLA_DAYS[resolved];
  if (days === undefined || !lastActivityAt) return null;
  const last = new Date(lastActivityAt);
  if (Number.isNaN(last.getTime())) return null;
  return new Date(last.getTime() + days * DAY_MS);
}

/** True when the case has exceeded its SLA threshold. Terminal states are never breaches. */
export function isSlaBreached(status: string, lastActivityAt?: string | null, now: Date = new Date()): boolean {
  if (isTerminalStatus(status)) return false;
  const dueAt = getSlaDueAt(status, lastActivityAt);
  if (!dueAt) return false;
  return now.getTime() > dueAt.getTime();
}

/** Human-friendly remaining/overdue summary for a case, e.g. "2d left" / "1d overdue". */
export function slaSummary(status: string, lastActivityAt?: string | null, now: Date = new Date()): string | null {
  const dueAt = getSlaDueAt(status, lastActivityAt);
  if (!dueAt) return null;
  const diffDays = Math.floor((dueAt.getTime() - now.getTime()) / DAY_MS);
  if (diffDays > 0) return `${diffDays}d left`;
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  return 'due today';
}
