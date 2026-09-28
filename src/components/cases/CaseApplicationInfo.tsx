import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, GraduationCap, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { majorsData } from "@/data/majorsData";
import AppointmentActionMenu from "@/components/team/AppointmentActionMenu";

interface Props {
  caseId: string;
  preferredMajorId: string | null;
  degreeInterest: string | null;
  onChanged?: () => void;
}

type Visit = { id: string; scheduled_at: string; status: string; confirmation_status: string | null; outcome: string | null; office_id: string | null };
type Office = { name_ar: string; name_en: string; name_he: string; city: string; address_line_1: string | null; timezone: string };

/** Chosen major + office visit booked on the apply form. Read-only. */
export default function CaseApplicationInfo({ caseId, preferredMajorId, degreeInterest, onChanged }: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const isAr = (i18n?.language ?? "") === "ar";
  const [visit, setVisit] = useState<Visit | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    // office_id is newer than the generated DB types, so this query is cast.
    (supabase as unknown as { from: (table: string) => any })
      .from("appointments")
      .select("id, scheduled_at, status, confirmation_status, outcome, office_id")
      .eq("case_id", caseId)
      .eq("public_booking", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data, error }: { data: any; error: any }) => {
        if (cancelled) return;
        if (error) console.warn("visit lookup failed", error.message);
        const nextVisit = (data as Visit) ?? null;
        setVisit(nextVisit);
        if (nextVisit?.office_id) {
          const { data: officeData } = await (supabase as unknown as { from: (table: string) => any })
            .from("offices")
            .select("name_ar, name_en, name_he, city, address_line_1, timezone")
            .eq("id", nextVisit.office_id)
            .maybeSingle();
          if (!cancelled) setOffice((officeData as Office) ?? null);
        } else {
          setOffice(null);
        }
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [caseId, reload]);

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
    ? new Intl.DateTimeFormat(
        i18n.language.startsWith("ar") ? "ar-u-nu-latn" : i18n.language.startsWith("he") ? "he" : "en-US",
        {
          timeZone: office?.timezone || "Asia/Jerusalem",
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        },
      ).format(new Date(visit.scheduled_at))
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
              {visit.status !== "cancelled" && visit.confirmation_status === "pending" && (
                <div className="mt-2">
                  <AppointmentActionMenu appointmentId={visit.id} onDone={() => { setReload((n) => n + 1); onChanged?.(); }} />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("case.application.noVisit", "No visit booked")}</p>
          )}
        </div>
      </div>
      {office ? (
        <div className="flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">{t("case.application.office", "Office")}</p>
            <p className="truncate text-sm font-medium" title={isAr ? office.name_ar : i18n.language.startsWith("he") ? (office.name_he || office.name_en) : office.name_en}>
              {isAr ? office.name_ar : i18n.language.startsWith("he") ? (office.name_he || office.name_en) : office.name_en}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {office.address_line_1 || office.city}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
