import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { majorsData } from "@/data/majorsData";

interface Props {
  caseId: string;
  preferredMajorId: string | null;
  degreeInterest: string | null;
}

type Visit = { scheduled_at: string; status: string; confirmation_status: string | null; outcome: string | null };

/** Chosen major + office visit booked on the apply form. Read-only. */
export default function CaseApplicationInfo({ caseId, preferredMajorId, degreeInterest }: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    supabase
      .from("appointments")
      .select("scheduled_at, status, confirmation_status, outcome")
      .eq("case_id", caseId)
      .eq("public_booking", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("visit lookup failed", error.message);
        setVisit((data as Visit) ?? null);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [caseId]);

  const major = preferredMajorId
    ? majorsData.flatMap((c) => c.subMajors).find((m) => m.id === preferredMajorId)
    : undefined;
  const majorLabel = major ? (isAr ? major.nameAR : major.nameEN) : degreeInterest;

  const visitStatus = !visit
    ? null
    : visit.status === "cancelled"
      ? t("case.application.cancelled", "Cancelled")
      : visit.confirmation_status === "pending"
        ? t("case.application.pending", "Pending confirmation")
        : t("case.application.confirmed", "Confirmed");
  const visitTone = !visit || visit.status === "cancelled"
    ? "text-muted-foreground"
    : visit.confirmation_status === "pending" ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400";

  const when = visit
    ? new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(visit.scheduled_at))
    : null;

  return (
    <section className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2">
      <div className="flex min-w-0 items-start gap-2">
        <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{t("case.application.major", "Chosen major")}</p>
          <p className={`truncate text-sm font-medium ${majorLabel ? "" : "text-muted-foreground"}`} title={majorLabel ?? undefined}>
            {majorLabel || t("case.overview.notSet")}
          </p>
        </div>
      </div>
      <div className="flex min-w-0 items-start gap-2">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{t("case.application.visit", "Office visit")}</p>
          {!loaded ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : visit ? (
            <>
              <p className="text-sm font-medium" dir="ltr">{when}</p>
              <p className={`text-xs ${visitTone}`}>{visitStatus}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("case.application.noVisit", "No visit booked")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
