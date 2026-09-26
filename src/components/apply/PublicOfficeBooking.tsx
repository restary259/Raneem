import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ar, enUS } from "date-fns/locale";
import { CalendarDays, Check, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { managePublicBooking } from "@/lib/publicBooking.functions";

const OFFICE_ZONE = "Asia/Jerusalem";
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: OFFICE_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const localDate = (key: string) => new Date(`${key}T12:00:00`);
const formatVisit = (iso: string, language: string) => new Intl.DateTimeFormat(language === "ar" ? "ar-u-nu-latn" : "en-US", {
  timeZone: OFFICE_ZONE, weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(iso));
const formatTime = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: OFFICE_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

export default function PublicOfficeBooking({ token, autoOpen = false }: { token: string; autoOpen?: boolean }) {
  const { t, i18n } = useTranslation("landing");
  const booking = useServerFn(managePublicBooking);
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [selected, setSelected] = useState("");
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const language = i18n.language.startsWith("ar") ? "ar" : "en";

  useEffect(() => {
    let live = true;
    setLoading(true);
    setInvalid(false);
    setOpen(false);
    setError("");
    booking({ data: { token, action: "read" } }).then((value) => {
      if (!live) return;
      if (value && typeof value === "object" && "scheduled_at" in value) {
        setCurrent(typeof value.scheduled_at === "string" ? value.scheduled_at : "");
        setStatus(typeof value.status === "string" ? value.status : "");
      }
      if (autoOpen) {
        setOpen(true);
        setWorking(true);
        return booking({ data: { token, action: "availability" } }).then((result) => {
          if (!live) return;
          const available = result && typeof result === "object" && "slots" in result && Array.isArray(result.slots)
            ? result.slots.filter((slot): slot is string => typeof slot === "string").sort() : [];
          setSlots(available);
          setSelectedDay(available.length ? dayKey(available[0]) : "");
        }).catch(() => { if (live) { setOpen(false); setError("availability"); } })
          .finally(() => { if (live) setWorking(false); });
      }
    }).catch(() => { if (live) setInvalid(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [booking, token, autoOpen]);

  const days = useMemo(() => new Set(slots.map(dayKey)), [slots]);
  const daySlots = useMemo(() => slots.filter((slot) => dayKey(slot) === selectedDay), [slots, selectedDay]);
  const firstDay = slots.length ? localDate(dayKey(slots[0])) : undefined;
  const lastDay = slots.length ? localDate(dayKey(slots[slots.length - 1])) : undefined;

  const loadSlots = async () => {
    setSlots([]);
    setSelectedDay("");
    setSelected("");
    setOpen(true);
    setWorking(true);
    setError("");
    try {
      const result = await booking({ data: { token, action: "availability" } });
      const available = result && typeof result === "object" && "slots" in result && Array.isArray(result.slots)
        ? result.slots.filter((slot): slot is string => typeof slot === "string").sort() : [];
      setSlots(available);
      setSelectedDay(available.length ? dayKey(available[0]) : "");
      setSelected("");
    } catch { setOpen(false); setError(t("apply.bookingUnavailable")); }
    finally { setWorking(false); }
  };

  const change = async (action: "book" | "reschedule" | "cancel") => {
    setWorking(true);
    setError("");
    try {
      const result = await booking({ data: { token, action, slot: action === "cancel" ? undefined : selected } });
      if (action === "cancel") { setCurrent(""); setStatus(""); }
      else if (result && typeof result === "object" && "scheduled_at" in result) {
        setCurrent(typeof result.scheduled_at === "string" ? result.scheduled_at : selected);
        setStatus(typeof result.status === "string" ? result.status : "pending");
      }
      setSelected(""); setOpen(false);
    } catch { setError(t("apply.bookingUnavailable")); }
    finally { setWorking(false); }
  };

  if (loading) return <div role="status" className="flex min-h-24 items-center justify-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /><span className="sr-only">{t("apply.loadingVisit")}</span></div>;
  if (invalid) return <p role="alert" className="border-s-2 border-destructive bg-muted px-4 py-3 text-sm leading-6 text-foreground">{t("apply.invalidVisitLink")}</p>;

  return <div className="w-full space-y-5 text-start">
    {current && <div role="status" className="rounded-2xl border border-brand/20 bg-editorial-paper p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand-strong">
          <CalendarDays className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-strong">{t(status === "confirmed" ? "apply.visitConfirmed" : "apply.visitPending")}</p>
          <p className="mt-1 font-semibold text-foreground" dir="auto">{formatVisit(current, language)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("apply.officeLocation")}</p>
        </div>
      </div>
    </div>}

    {!open ? (
      <Button type="button" onClick={loadSlots} variant={current ? "outline" : "default"} className="h-11 w-full" disabled={working}>
        <CalendarDays aria-hidden="true" />{t(current ? "apply.changeVisit" : "apply.bookVisit")}
      </Button>
    ) : (
      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(290px,0.75fr)] lg:items-start">
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-full bg-brand-strong/10 text-brand-strong">
                <MapPin className="size-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("apply.pickTime")}</p>
                <p className="text-xs text-muted-foreground">{t("apply.requestNotice")}</p>
              </div>
            </div>

            {working && !slots.length ? (
              <div className="flex h-52 items-center justify-center rounded-2xl border border-border bg-card" role="status">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="sr-only">{t("apply.loadingVisit")}</span>
              </div>
            ) : slots.length && firstDay && lastDay ? (
              <>
                <div className="rounded-2xl border border-border bg-card p-2 shadow-sm sm:p-3">
                  <Calendar
                    mode="single"
                    locale={language === "ar" ? ar : enUS}
                    numerals="latn"
                    dir={language === "ar" ? "rtl" : "ltr"}
                    selected={selectedDay ? localDate(selectedDay) : undefined}
                    onSelect={(day) => { setSelectedDay(day ? dateKey(day) : ""); setSelected(""); }}
                    disabled={(day) => working || !days.has(dateKey(day))}
                    startMonth={firstDay}
                    endMonth={lastDay}
                    defaultMonth={firstDay}
                    showOutsideDays={false}
                    className="pointer-events-auto mx-auto w-fit p-1 sm:p-2 [--rdp-day_button-width:42px] [--rdp-day_button-height:42px]"
                  />
                </div>

                {selectedDay && <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">{t("apply.availableTimes")}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" dir="ltr">
                    {daySlots.map((slot) => (
                      <Button
                        key={slot}
                        type="button"
                        variant={selected === slot ? "default" : "outline"}
                        disabled={working || confirming}
                        onClick={() => setSelected(slot)}
                        aria-pressed={selected === slot}
                        className="h-11 w-full rounded-xl px-2 tabular-nums transition-all duration-200"
                      >
                        {selected === slot && <Check aria-hidden="true" />}{formatTime(slot)}
                      </Button>
                    ))}
                  </div>
                </div>}
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{t("apply.noTimes")}</p>
            )}
          </div>

          <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:sticky lg:top-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-strong/10 text-brand-strong">
                <MapPin className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold">DARB</p>
                <p className="text-xs text-muted-foreground">{t("apply.officeLocation")}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("apply.manageVisit")}</p>
              <p className="mt-2 text-sm font-semibold text-foreground" dir="auto">
                {selected ? formatVisit(selected, language) : t("apply.chooseTimePlaceholder", { defaultValue: language === "ar" ? "اختر وقتًا لرؤية التفاصيل هنا." : "Choose a time to see the details here." })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("apply.officeLocation")}</p>
            </div>

            {selected && !confirming && (
              <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-4 animate-fade-in motion-reduce:animate-none">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-strong" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t("apply.lastConfirmTitle")}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("apply.lastConfirmDescription")}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-brand/10 pt-4">
                  <p className="font-semibold text-foreground" dir="auto">{formatVisit(selected, language)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("apply.officeLocation")}</p>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setSelected("")}>{t("apply.changeTime")}</Button>
                  <Button type="button" className="flex-1" disabled={working} onClick={async () => { setConfirming(true); await change(current ? "reschedule" : "book"); setConfirming(false); }}>
                    <Check aria-hidden="true" />{t("apply.confirmAppointment")}
                  </Button>
                </div>
              </div>
            )}

            {confirming && (
              <div role="status" className="mt-4 rounded-xl border border-border bg-muted/30 p-4 text-sm">
                <Loader2 className="me-2 inline size-4 animate-spin" />{t("apply.confirmingAppointment")}
              </div>
            )}

            <div className="mt-4 rounded-xl border border-border bg-background/70 p-3">
              <p className="text-xs leading-5 text-muted-foreground">
                {t("apply.bookingReassurance", { defaultValue: language === "ar" ? "ما بيتثبت الموعد إلا بعد تأكيدك." : "Your appointment is not requested until you confirm this final step." })}
              </p>
            </div>
          </aside>
        </div>

        <Button type="button" variant="ghost" onClick={() => { setOpen(false); setError(""); }} className="w-full" disabled={working}>{t("apply.closeCalendar")}</Button>
      </div>
    )}

    {current && !open && <Button type="button" variant="link" className="h-auto px-0 text-destructive" disabled={working} onClick={() => change("cancel")}>{t("apply.cancelVisit")}</Button>}
    {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm leading-6 text-destructive">{error === "availability" ? t("apply.bookingUnavailable") : error}</p>}
  </div>;
}>;
}
