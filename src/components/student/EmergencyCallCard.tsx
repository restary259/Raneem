import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Ambulance, Flame, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * German emergency numbers. These are fixed national short codes — they are
 * deliberately NOT sourced from `important_contacts` or `contactConfig`, which
 * hold Darb's own contact details. Dialling them hands off to the phone's
 * native dialer via a `tel:` link, so the student calls emergency services
 * directly instead of opening a chat.
 *
 * They are Germany-only: `110`/`112` are only guaranteed to reach the German
 * service when dialled from within Germany (112 is the EU-wide number, but 110
 * is national). The card says so, because the student may travel — the app does
 * not geolocate and must not imply the number works everywhere.
 */
export const EMERGENCY_NUMBERS = [
  { key: "police", number: "110", icon: ShieldAlert, tone: "blue" },
  { key: "ambulance", number: "112", icon: Ambulance, tone: "red" },
  { key: "fire", number: "112", icon: Flame, tone: "orange" },
] as const;

/** English fallbacks used when the locale dictionary is unavailable. */
const FALLBACK_LABEL: Record<string, string> = {
  police: "Police",
  ambulance: "Ambulance",
  fire: "Fire brigade",
};

const TONE_CLASS: Record<string, { icon: string; border: string }> = {
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    border: "hover:border-blue-500/60",
  },
  red: {
    icon: "text-red-600 dark:text-red-400",
    border: "hover:border-red-500/60",
  },
  orange: {
    icon: "text-orange-600 dark:text-orange-400",
    border: "hover:border-orange-500/60",
  },
};

/**
 * Full-width emergency call strip for the student dashboard.
 *
 * Each entry is a `tel:` anchor (never a chat button): tapping it opens the
 * native call confirmation so the student dials police / ambulance / fire
 * directly. Layout is a single column on phones and three columns from `sm`,
 * with `min-w-0` so a long translated label cannot widen its grid track.
 */
export default function EmergencyCallCard({
  className,
}: {
  className?: string;
}) {
  const { t } = useTranslation("dashboard");

  return (
    <Card className={cn("border-red-500/30", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
          {t("student.overview.emergency", "Emergency numbers")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t(
            "student.overview.emergencyHint",
            "Tap a number to call directly from your phone.",
          )}
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          {t(
            "student.overview.emergencyLocationHint",
            "These are Germany's emergency numbers — they work while you are in Germany.",
          )}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {EMERGENCY_NUMBERS.map(({ key, number, icon: Icon, tone }) => (
            <a
              key={key}
              href={`tel:${number}`}
              className={cn(
                "flex w-full min-w-0 items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent",
                TONE_CLASS[tone].border,
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", TONE_CLASS[tone].icon)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {t(`student.overview.emergency_${key}`, FALLBACK_LABEL[key])}
                </span>
                <span className="block text-xs text-muted-foreground" dir="ltr">
                  {number}
                </span>
              </span>
              <PhoneCall className="h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact, label-less variant of the same emergency numbers, for the chat box
 * header where horizontal room is scarce. Same `tel:` handoff — never a chat.
 */
export function EmergencyNumberButtons({ className }: { className?: string }) {
  const { t } = useTranslation("dashboard");

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      {EMERGENCY_NUMBERS.map(({ key, number, icon: Icon, tone }) => {
        const label = t(
          `student.overview.emergency_${key}`,
          FALLBACK_LABEL[key],
        );
        return (
          <a
            key={key}
            href={`tel:${number}`}
            aria-label={`${label} ${number}`}
            title={`${label} · ${number}`}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border transition-colors hover:bg-accent",
              TONE_CLASS[tone].icon,
            )}
          >
            <Icon className="h-4 w-4" />
          </a>
        );
      })}
    </div>
  );
}
