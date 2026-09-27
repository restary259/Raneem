import type { AppRole } from "@/contexts/AuthContext";

/**
 * Single source of truth for which notification categories exist and which
 * dashboard roles can actually receive them.
 *
 * The `column` is the matching `notification_preferences` boolean the push
 * dispatcher reads (`cat_*`). The backend mirror in
 * `supabase/functions/_shared/notificationCategories.ts` must list the same
 * keys and columns — `notificationCategories.test.ts` fails the suite if the
 * two drift.
 *
 * Role scoping is display-only: a hidden category's saved value is left
 * untouched, so delivery for a category a role "doesn't see" is unchanged.
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

export interface NotificationCategory {
  key: NotificationCategoryKey;
  /** The `notification_preferences` column the push dispatcher gates on. */
  column: string;
  /** Roles whose settings should surface this category. */
  roles: readonly AppRole[];
}

export const ALL_ROLES: readonly AppRole[] = [
  "admin",
  "team_member",
  "social_media_partner",
  "ambassador",
  "agent",
  "student",
];

/** Partner-family roles share one notification surface (the /partner routes). */
const PARTNER_FAMILY: readonly AppRole[] = [
  "social_media_partner",
  "ambassador",
  "agent",
];

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  { key: "messages", column: "cat_messages", roles: ALL_ROLES },
  {
    key: "appointments",
    column: "cat_appointments",
    roles: ["admin", "team_member", "student"],
  },
  { key: "cases", column: "cat_cases", roles: ALL_ROLES },
  { key: "payments", column: "cat_payments", roles: ALL_ROLES },
  {
    key: "documents",
    column: "cat_documents",
    roles: ["admin", "team_member", "student"],
  },
  { key: "profile", column: "cat_profile", roles: ["team_member", "student"] },
  {
    key: "recruitment",
    column: "cat_recruitment",
    roles: ["admin", ...PARTNER_FAMILY],
  },
  { key: "calls", column: "cat_calls", roles: ALL_ROLES },
  { key: "system", column: "cat_system", roles: ALL_ROLES },
] as const;

/** key → preference column, for the backend drift guard. */
export const NOTIFICATION_CATEGORY_COLUMNS: Record<
  NotificationCategoryKey,
  string
> = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map((c) => [c.key, c.column]),
) as Record<NotificationCategoryKey, string>;

/** Categories to render for a dashboard role, in catalog order. */
export function categoriesForRole(
  role: AppRole | null | undefined,
): NotificationCategory[] {
  if (!role) return [];
  return NOTIFICATION_CATEGORIES.filter((c) => c.roles.includes(role));
}
