/**
 * Backend mirror of `src/lib/notificationCategories.ts`.
 *
 * `push-dispatch` imports `notificationCategoryColumn` so the queue drainer and
 * the dashboard settings agree on which `notification_preferences.cat_*`
 * column each notification category gates on. The two files are kept in step
 * by `src/lib/notificationCategories.test.ts`.
 *
 * Deno cannot import from `src/`, so this is a deliberate copy rather than a
 * symlink; the vitest drift guard is what keeps it honest.
 */

export type NotificationCategoryKey =
  | "messages"
  | "appointments"
  | "cases"
  | "payments"
  | "documents"
  | "profile"
  | "recruitment"
  | "calls"
  | "system";

export const NOTIFICATION_CATEGORY_COLUMNS: Record<NotificationCategoryKey, string> = {
  messages: "cat_messages",
  appointments: "cat_appointments",
  cases: "cat_cases",
  payments: "cat_payments",
  documents: "cat_documents",
  profile: "cat_profile",
  recruitment: "cat_recruitment",
  // Incoming voice calls — the notification_preferences.cat_calls column added
  // in 20260928130000. Without this mapping a call would be gated by cat_system
  // instead of its own switch.
  calls: "cat_calls",
  system: "cat_system",
};

/**
 * Resolve a notification's category to its preference column. Unknown
 * categories fall back to `cat_system`, matching the settings UI which always
 * renders a System switch.
 */
export function notificationCategoryColumn(category: string | null | undefined): string {
  const key = (category ?? "system") as NotificationCategoryKey;
  return NOTIFICATION_CATEGORY_COLUMNS[key] ?? "cat_system";
}
