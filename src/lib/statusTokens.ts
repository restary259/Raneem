/**
 * Semantic status tokens — the single source of truth for every case/stage
 * colour in the dashboards.
 *
 * Colours are defined ONCE per theme in `src/index.css` as HSL custom
 * properties (`--status-new` … `--status-danger`). Components never hardcode
 * palette classes; they ask for a tone here and get theme-aware classes that
 * work identically in light, dark and aurora.
 *
 * Meaning is never conveyed by colour alone — every consumer pairs the tone
 * with a label (and, for attention states, an icon).
 */

export type StatusTone =
  | "new"
  | "contacted"
  | "appointment"
  | "profile"
  | "payment"
  | "submitted"
  | "enrolled"
  | "paid"
  | "danger"
  | "neutral";

export interface ToneClasses {
  /** Pill / badge treatment. */
  chip: string;
  /** Thin colored edge accent (left border in LTR, right in RTL). */
  line: string;
  /** Small status dot. */
  dot: string;
  /** Very subtle background tint for a whole surface. */
  tint: string;
  /** Foreground text colour only. */
  text: string;
  /** Solid fill (progress segments, filled rail dots). */
  fill: string;
}

/**
 * Tailwind needs statically analysable class strings, so each tone is spelled
 * out rather than generated from a template.
 */
const TONES: Record<StatusTone, ToneClasses> = {
  new: {
    chip: "bg-[hsl(var(--status-new)/0.14)] text-[hsl(var(--status-new))] border-[hsl(var(--status-new)/0.28)]",
    line: "bg-[hsl(var(--status-new))]",
    dot: "bg-[hsl(var(--status-new))]",
    tint: "bg-[hsl(var(--status-new)/0.07)]",
    text: "text-[hsl(var(--status-new))]",
    fill: "bg-[hsl(var(--status-new))]",
  },
  contacted: {
    chip: "bg-[hsl(var(--status-contacted)/0.14)] text-[hsl(var(--status-contacted))] border-[hsl(var(--status-contacted)/0.28)]",
    line: "bg-[hsl(var(--status-contacted))]",
    dot: "bg-[hsl(var(--status-contacted))]",
    tint: "bg-[hsl(var(--status-contacted)/0.07)]",
    text: "text-[hsl(var(--status-contacted))]",
    fill: "bg-[hsl(var(--status-contacted))]",
  },
  appointment: {
    chip: "bg-[hsl(var(--status-appointment)/0.14)] text-[hsl(var(--status-appointment))] border-[hsl(var(--status-appointment)/0.28)]",
    line: "bg-[hsl(var(--status-appointment))]",
    dot: "bg-[hsl(var(--status-appointment))]",
    tint: "bg-[hsl(var(--status-appointment)/0.07)]",
    text: "text-[hsl(var(--status-appointment))]",
    fill: "bg-[hsl(var(--status-appointment))]",
  },
  profile: {
    chip: "bg-[hsl(var(--status-profile)/0.14)] text-[hsl(var(--status-profile))] border-[hsl(var(--status-profile)/0.28)]",
    line: "bg-[hsl(var(--status-profile))]",
    dot: "bg-[hsl(var(--status-profile))]",
    tint: "bg-[hsl(var(--status-profile)/0.07)]",
    text: "text-[hsl(var(--status-profile))]",
    fill: "bg-[hsl(var(--status-profile))]",
  },
  payment: {
    chip: "bg-[hsl(var(--status-payment)/0.14)] text-[hsl(var(--status-payment))] border-[hsl(var(--status-payment)/0.28)]",
    line: "bg-[hsl(var(--status-payment))]",
    dot: "bg-[hsl(var(--status-payment))]",
    tint: "bg-[hsl(var(--status-payment)/0.07)]",
    text: "text-[hsl(var(--status-payment))]",
    fill: "bg-[hsl(var(--status-payment))]",
  },
  submitted: {
    chip: "bg-[hsl(var(--status-submitted)/0.14)] text-[hsl(var(--status-submitted))] border-[hsl(var(--status-submitted)/0.28)]",
    line: "bg-[hsl(var(--status-submitted))]",
    dot: "bg-[hsl(var(--status-submitted))]",
    tint: "bg-[hsl(var(--status-submitted)/0.07)]",
    text: "text-[hsl(var(--status-submitted))]",
    fill: "bg-[hsl(var(--status-submitted))]",
  },
  enrolled: {
    chip: "bg-[hsl(var(--status-enrolled)/0.14)] text-[hsl(var(--status-enrolled))] border-[hsl(var(--status-enrolled)/0.28)]",
    line: "bg-[hsl(var(--status-enrolled))]",
    dot: "bg-[hsl(var(--status-enrolled))]",
    tint: "bg-[hsl(var(--status-enrolled)/0.07)]",
    text: "text-[hsl(var(--status-enrolled))]",
    fill: "bg-[hsl(var(--status-enrolled))]",
  },
  paid: {
    chip: "bg-[hsl(var(--status-paid)/0.14)] text-[hsl(var(--status-paid))] border-[hsl(var(--status-paid)/0.28)]",
    line: "bg-[hsl(var(--status-paid))]",
    dot: "bg-[hsl(var(--status-paid))]",
    tint: "bg-[hsl(var(--status-paid)/0.07)]",
    text: "text-[hsl(var(--status-paid))]",
    fill: "bg-[hsl(var(--status-paid))]",
  },
  danger: {
    chip: "bg-[hsl(var(--status-danger)/0.14)] text-[hsl(var(--status-danger))] border-[hsl(var(--status-danger)/0.28)]",
    line: "bg-[hsl(var(--status-danger))]",
    dot: "bg-[hsl(var(--status-danger))]",
    tint: "bg-[hsl(var(--status-danger)/0.07)]",
    text: "text-[hsl(var(--status-danger))]",
    fill: "bg-[hsl(var(--status-danger))]",
  },
  neutral: {
    chip: "bg-muted text-muted-foreground border-border",
    line: "bg-border",
    dot: "bg-muted-foreground/50",
    tint: "bg-muted/40",
    text: "text-muted-foreground",
    fill: "bg-muted-foreground/40",
  },
};

/** Pipeline stage key → tone. */
export const TONE_BY_STATUS: Record<string, StatusTone> = {
  new: "new",
  contacted: "contacted",
  appointment_scheduled: "appointment",
  profile_completion: "profile",
  payment_confirmed: "payment",
  submitted: "submitted",
  enrollment_paid: "enrolled",
  enrolled: "enrolled",
  forgotten: "danger",
  cancelled: "neutral",
};

/** Legacy admin-configurable colour names → tone. */
export const TONE_BY_COLOR_NAME: Record<string, StatusTone> = {
  slate: "new",
  gray: "neutral",
  blue: "contacted",
  purple: "appointment",
  violet: "appointment",
  cyan: "profile",
  yellow: "profile",
  amber: "payment",
  teal: "payment",
  orange: "submitted",
  indigo: "submitted",
  green: "enrolled",
  red: "danger",
};

export function toneClasses(tone: StatusTone): ToneClasses {
  return TONES[tone] ?? TONES.neutral;
}

/** Tone for a pipeline status key (falls back to neutral). */
export function toneForStatus(status?: string | null): StatusTone {
  return TONE_BY_STATUS[status ?? ""] ?? "neutral";
}

/** Tone for a legacy colour name stored in `pipeline_statuses.color`. */
export function toneForColorName(color?: string | null): StatusTone {
  return TONE_BY_COLOR_NAME[color ?? ""] ?? "neutral";
}

/** Attention level → tone, used by SLA / priority indicators. */
export type AttentionLevel = "normal" | "warn" | "overdue";

export function toneForAttention(level: AttentionLevel): StatusTone {
  if (level === "overdue") return "danger";
  if (level === "warn") return "payment";
  return "neutral";
}
