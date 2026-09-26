import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ar, enUS } from "date-fns/locale";
import { CalendarDays, Check, CheckCircle2, Clock, Loader2, MapPin, ShieldCheck, X } from "lucide-react";
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
const formatDay = (iso: string, language: string) => new Intl.DateTimeFormat(language === "ar" ? "ar-u-nu-latn" : "en-US", {
  timeZone: OFFICE_ZONE, weekday: "long", month: "long", day: "numeric",
}).format(new Date(iso));
const formatTime = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: OFFICE_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

const strings = (value: unknown, key: "slots" | "unavailable") =>
  value && typeof value === "object" && key in value && Array.isArray((value as Record<string, unknown>)[key])
    ? ((value as Record<string, unknown[]>)[key]).filter((slot): slot is string => typeof slot === "string").sort() : [];

export default function PublicOfficeBooking({ token, autoOpen = false, onBooked }: { token: string; autoOpen?: boolean; onBooked?: () => void }) {
  const { t, i18n } = useTranslation("landing");
  const booking = useServerFn(managePublicBooking);
  const [slots, setSlots] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [selected, setSelected] = useState("");
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
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
          const available = strings(result, "slots");
          setSlots(available);
          setUnavailable(strings(result, "unavailable"));
          setSelectedDay(available.length ? dayKey(available[0]) : "");
        }).catch(() => { if (live) { setOpen(false); setError("availability"); } })
          .finally(() => { if (live) setWorking(false); });
      }
    }).catch(() => { if (live) setInvalid(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [booking, token, autoOpen]);

  const days = useMemo(() => new Set(slots.map(dayKey)), [slots]);
  const available = useMemo(() => new Set(slots), [slots]);
  const daySlots = useMemo(() => [...slots, ...unavailable].filter((slot) => dayKey(slot) === selectedDay).sort(), [slots, unavailable, selectedDay]);
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
      const available = strings(result, "slots");
      setSlots(available);
      setUnavailable(strings(result, "unavailable"));
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
      if (result && typeof result === "object" && "error" in result && result.error === "slot_taken") {
        setError(t("apply.slotTaken"));
        setUnavailable((prev) => (selected ? [...prev, selected] : prev));
        setSlots((prev) => prev.filter((s) => s !== selected));
        setSelected("");
        return;
      }
      if (action === "cancel") { setCurrent(""); setStatus(""); }
      else if (result && typeof result === "object" && "scheduled_at" in result) {
        setCurrent(typeof result.scheduled_at === "string" ? result.scheduled_at : selected);
        setStatus(typeof result.status === "string" ? result.status : "pending");
      }
      setSelected(""); setOpen(false);
      if (action !== "cancel") onBooked?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message === "Time unavailable" ? t("apply.slotTaken") : t("apply.bookingUnavailable"));
    } finally { setWorking(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-12" role="status" aria-label={t("apply.loadingVisit")}><Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" /></div>;
  }
  if (invalid) {
    return <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{t("apply.invalidVisitLink")}</p>;
  }

  // ── Booked state ──────────────────────────────────────────────
  if (current) {
    const confirmed = status === "confirmed";
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold">{t("apply.visitRequestedTitle", "تم إرسال طلب زيارتك")}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("apply.visitRequestedBody", "سيؤكد فريق درب موعدك ويرسل لك التفاصيل عبر واتساب.")}</p>
          <div className="mx-auto mt-5 grid max-w-sm gap-2 text-start text-sm">
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="font-medium">{formatDay(current, language)}</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="font-medium" dir="ltr">{formatTime(current)}</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="font-medium">{t("apply.officeLocation")}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadSlots} disabled={working}>
            {working ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t("apply.changeVisit")}
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => change("cancel")} disabled={working}>
            {t("apply.cancelVisit")}
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {open && <BookingFlow />}
      </div>
    );
  }

  // ── Not booked yet ────────────────────────────────────────────
  if (!open) {
    return (
      <div className="space-y-3">
        <Button onClick={loadSlots} disabled={working}>
          {working ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CalendarDays aria-hidden="true" />}
          {t("apply.bookVisit")}
        </Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return <BookingFlow />;

  function BookingFlow() {
    const phase = selected ? 2 : selectedDay ? 1 : 0;
    const steps = [
      t("apply.bookingStepDate", "اختر التاريخ"),
      t("apply.bookingStepTime", "اختر الوقت"),
      t("apply.bookingStepConfirm", "التأكيد"),
    ];
    return (
      <div className="space-y-5">
        {/* Mini step indicator */}
        <ol className="flex items-center gap-2" aria-label={t("apply.manageVisit")}>
          {steps.map((label, i) => {
            const done = i < phase;
            const active = i === phase;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                    done ? "bg-primary text-primary-foreground" : active ? "border-2 border-primary text-primary" : "border border-border text-muted-foreground"
                  }`}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className={`hidden text-xs font-medium sm:block ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                {i < steps.length - 1 && <span className={`h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
          {/* Calendar + times */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDay ? localDate(selectedDay) : undefined}
                  onSelect={(date) => { if (date && days.has(dateKey(date))) { setSelectedDay(dateKey(date)); setSelected(""); } }}
                  disabled={(date) => !days.has(dateKey(date))}
                  {...(firstDay && lastDay ? { startMonth: firstDay, endMonth: lastDay } : {})}
                  locale={language === "ar" ? ar : enUS}
                />
              </div>
              {/* Legend */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-primary/30 ring-1 ring-primary/50" aria-hidden="true" />
                  {t("apply.legendAvailable", "متاح")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />
                  {t("apply.legendSelected", "مختار")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-muted-foreground/20" aria-hidden="true" />
                  {t("apply.legendUnavailable", "غير متاح")}
                </span>
              </div>
            </div>

            {/* Time grid */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold">{t("apply.availableTimes")}</p>
              {working && slots.length === 0 ? (
                <div className="flex justify-center py-6" role="status"><Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
              ) : daySlots.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t("apply.noTimes")}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {daySlots.map((slot) => {
                    const isSelected = selected === slot;
                    const isOpen = available.has(slot);
                    if (!isOpen) {
                      return (
                        <button key={slot} type="button" disabled aria-label={`${formatTime(slot)} — ${t("apply.legendUnavailable")}`} className="cursor-not-allowed rounded-lg border border-dashed border-border bg-muted/40 px-2 py-2.5 text-sm tabular-nums text-muted-foreground/60 line-through" dir="ltr">
                          {formatTime(slot)}
                        </button>
                      );
                    }
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelected(slot)}
                        aria-pressed={isSelected}
                        disabled={working}
                        className={`rounded-lg border px-2 py-2.5 text-sm font-medium tabular-nums transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-background hover:border-primary/60 hover:bg-primary/5"
                        }`}
                        dir="ltr"
                      >
                        {formatTime(slot)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Summary aside */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-4 text-sm font-semibold">{t("apply.summaryTitle", "تفاصيل الزيارة")}</p>
              {selected ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t("apply.summaryDate", "التاريخ")}</p>
                      <p className="font-medium">{formatDay(selected, language)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t("apply.summaryTime", "الوقت")}</p>
                      <p className="font-medium" dir="ltr">{formatTime(selected)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t("apply.summaryLocation", "الموقع")}</p>
                      <p className="font-medium">{t("apply.officeLocation")}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">{t("apply.summaryEmpty", "اختر التاريخ والوقت لعرض التفاصيل هنا.")}</p>
              )}
              <Button
                className="mt-5 w-full"
                disabled={!selected || working}
                onClick={() => change(current ? "reschedule" : "book")}
              >
                {working ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                {t("apply.confirmVisit", "تأكيد طلب الزيارة")}
              </Button>
            </div>

            <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p>{t("apply.requestNotice")}</p>
            </div>

            <button
              type="button"
              onClick={() => { setOpen(false); setSelected(""); setError(""); }}
              disabled={working}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
              {t("apply.closeCalendar")}
            </button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </aside>
        </div>
      </div>
    );
  }
}
