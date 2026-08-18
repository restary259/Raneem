/**
 * Single source of truth for how DB role values map to display labels.
 * Use this everywhere — never inline role strings in components.
 */

export const ROLE_LABELS: Record<string, string> = {
  admin:                 "Admin",
  team_member:           "Team",
  agent:                 "Agent",
  social_media_partner:  "Social Media Partner",
  ambassador:            "Office Ambassador",
  student:               "Student",
};

export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}

/** Returns a Tailwind color class set for the role badge */
export function getRoleColors(role: string | null | undefined): string {
  switch (role) {
    case "admin":                return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
    case "team_member":          return "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300";
    case "agent":                return "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300";
    case "social_media_partner": return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
    case "ambassador":           return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    case "student":              return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    default:                     return "bg-muted text-muted-foreground";
  }
}
