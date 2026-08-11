/**
 * Maps the server-side `submit_case_for_review` gate failures to a
 * user-facing, translated message.
 *
 * The RPC raises `SUBMIT_BLOCKED: <reason>` exceptions when the case cannot be
 * submitted (missing profile/school/services/payment, etc.). Showing that raw
 * English string is broken for Arabic and leaks internal wording, so callers
 * route the error through {@link submitBlockedMessage} and fall back to a
 * generic failure only when the error is not a known blocker.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TranslateFn = (key: any, fallback?: any) => any;

const BLOCKERS: Array<{ match: RegExp; key: string }> = [
  {
    match: /school,\s*course\s+and\s+start\s+date/i,
    key: "case.submit.blockedReasons.schoolCourseRequired",
  },
  {
    match: /profile\s+must\s+be\s+complete/i,
    key: "case.submit.blockedReasons.profileIncomplete",
  },
  {
    match: /file\s+is\s+missing/i,
    key: "case.submit.blockedReasons.missingFile",
  },
  {
    match: /at\s+least\s+one\s+darb\s+service/i,
    key: "case.submit.blockedReasons.noServices",
  },
  {
    match: /payment\s+must\s+be\s+confirmed/i,
    key: "case.submit.blockedReasons.paymentNotConfirmed",
  },
  {
    match: /not\s+ready/i,
    key: "case.submit.blockedReasons.notReady",
  },
];

export function submitBlockedMessage(
  error: unknown,
  t: TranslateFn,
): string | null {
  const raw =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string"
        ? String((error as { message: string }).message)
        : "";

  const match = raw.match(/SUBMIT_BLOCKED:\s*(.*)$/i);
  if (!match) return null;

  const reason = (match[1] || "").trim();
  if (!reason) return t("case.submit.blocked", "The case cannot be submitted yet.");

  for (const blocker of BLOCKERS) {
    if (blocker.match.test(reason)) return t(blocker.key, blocker.key);
  }

  return t("case.submit.blocked", "The case cannot be submitted yet.");
}
