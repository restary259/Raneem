import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ar, enUS } from "date-fns/locale";
import { Building2, CalendarDays, Check, CheckCircle2, Clock, Loader2, MapPin, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { managePublicBooking } from "@/lib/publicBooking.functions";

type Office = {
  id: string;
  name_ar: string;
  name_en: string;
  name_he: string;
  city: string;
  address_line_1: string | null;
  phone: string | null;
  map_url: string | null;
  timezone: string;
};

const dayKey = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

const dateKey = (date: Date) =>
  date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");

const localDate = (key: string) => new Date(key + "T12:00:00");

const formatDay = (iso: string, language: string, timeZone: string) =>
  new Intl.DateTimeFormat(language === "ar" ? "ar-u-nu-latn" : language === "he" ? "he" : "en-US", {
    timeZone, weekday: "long", month: "long", day: "numeric",
  }).format(new Date(iso));

const formatTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

const officeName = (office: Office, language: string) =>
  language.startsWith("ar") ? office.name_ar : language.startsWith("he") ? office.name_he || office.name_en : office.name_en;

function slotStrings(value: unknown, key: "slots" | "unavailable") {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return Array.isArray(record[key])
    ? record[key].filter((slot): slot is string => typeof slot === "string").sort()
    : [];
}

export default function PublicOfficeBooking({
  token,
  autoOpen = false,
  onBooked,
}: {
  token: string;
  autoOpen?: boolean;
  onBooked?: () => void;
}) {
  const { t, i18n } = useTranslation("landing");
  const booking = useServerFn(managePublicBooking);
  const language = i18n.language;
  const isAr = language.startsWith("ar");

  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState("");
  const [currentOfficeId, setCurrentOfficeId] = useState("");
  const [officeTimezone, setOfficeTimezone] = useState("Asia/Jerusalem");
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

  const selectedOffice = useMemo(
    () => offices.find((office) => office.id === selectedOfficeId),
    [offices, selectedOfficeId],
  );

  const selectedTimezone = selectedOffice?.timezone || officeTimezone || "Asia/Jerusalem";
  const days = useMemo(() => new Set(slots.map((slot) => dayKey(slot, selectedTimezone))), [slots, selectedTimezone]);
  const available = useMemo(() => new Set(slots), [slots]);
  const daySlots = useMemo(
    () => [...slots, ...unavailable].filter((slot) => dayKey(slot, selectedTimezone) === selectedDay).sort(),
    [slots, unavailable, selectedDay, selectedTimezone],
  );
  const firstDay = slots.length ? localDate(dayKey(slots[0], selectedTimezone)) : undefined;
  const lastDay = slots.length ? localDate(dayKey(slots[slots.length - 1], selectedTimezone)) : undefined;

  const ui = useMemo(() => {
    if (language.startsWith("ar")) {
      return {
        chooseOffice: "اختار المكتب",
        officeHelp: "اختار المكان اللي بناسبك، وبعدها بتظهرلك المواعيد المتاحة.",
        noOffices: "ما في مكاتب متاحة للحجز حالياً.",
        selectedOffice: "المكتب",
        address: "العنوان",
        changeOffice: "تغيير المكتب",
        booked: "موعد محجوز",
        book: "احجز الموعد",
        confirm: "تأكيد الموعد",
      };
    }
    if (language.startsWith("he")) {
      return {
        chooseOffice: "בחירת משרד",
        officeHelp: "בחרו את המיקום המתאים לכם ולאחר מכן יוצגו השעות הזמינות.",
        noOffices: "אין כרגע משרדים זמינים להזמנה.",
        selectedOffice: "משרד",
        address: "כתובת",
        changeOffice: "שינוי משרד",
        booked: "פגישה מוזמנת",
        book: "הזמנת פגישה",
        confirm: "אישור הפגישה",
      };
    }
    return {
      chooseOffice: "Choose an office",
      officeHelp: "Choose the location that suits you, then we'll show its available times.",
      noOffices: "No offices are currently available for booking.",
      selectedOffice: "Office",
      address: "Address",
      changeOffice: "Change office",
      booked: "Booked appointment",
      book: "Book appointment",
      confirm: "Confirm appointment",
    };
  }, [language]);

  async function loadAvailability(officeId: string) {
    if (!officeId) return;
    setWorking(true);
    setError("");
    setSlots([]);
    setUnavailable([]);
    setSelectedDay("");
    setSelected("");
    try {
      const result = await booking({ data: { token, action: "availability", officeId } });
      const office = result && typeof result === "object" && "office" in result
        ? (result as { office?: Office }).office
        : undefined;
      if (office?.timezone) setOfficeTimezone(office.timezone);
      const nextSlots = slotStrings(result, "slots");
      const nextUnavailable = slotStrings(result, "unavailable");
      setSlots(nextSlots);
      setUnavailable(nextUnavailable);
      if (nextSlots.length) {
        const tz = office?.timezone || selectedOffice?.timezone || "Asia/Jerusalem";
        setSelectedDay(dayKey(nextSlots[0], tz));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message || t("apply.bookingUnavailable"));
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    let live = true;
    setLoading(true);
    setInvalid(false);
    setOpen(false);
    setError("");

    (async () => {
      try {
        const currentRead = await booking({ data: { token, action: "read" } });
        if (!live) return;
        if (currentRead && typeof currentRead === "object") {
          if ("scheduled_at" in currentRead && typeof currentRead.scheduled_at === "string") setCurrent(currentRead.scheduled_at);
          if ("status" in currentRead && typeof currentRead.status === "string") setStatus(currentRead.status);
          if ("office_id" in currentRead && typeof currentRead.office_id === "string") {
            setCurrentOfficeId(currentRead.office_id);
          }
        }

        const officeResult = await booking({ data: { token, action: "offices" } });
        if (!live) return;
        const nextOffices = officeResult && typeof officeResult === "object" && "offices" in officeResult
          ? ((officeResult as { offices?: Office[] }).offices || [])
          : [];
        const returnedCurrentOffice = officeResult && typeof officeResult === "object" && "current_office_id" in officeResult
          ? ((officeResult as { current_office_id?: string | null }).current_office_id || "")
          : "";
        setOffices(nextOffices);

        const nextSelectedOffice =
          returnedCurrentOffice && nextOffices.some((office) => office.id === returnedCurrentOffice)
            ? returnedCurrentOffice
            : nextOffices[0]?.id || "";

        setSelectedOfficeId(nextSelectedOffice);

        if (autoOpen) {
          setOpen(true);
          if (nextSelectedOffice) await loadAvailability(nextSelectedOffice);
        }
      } catch (err) {
        if (live) setInvalid(true);
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [booking, token, autoOpen]);

  const loadSlots = async () => {
    const officeId = selectedOfficeId || currentOfficeId || offices[0]?.id || "";
    if (!officeId) {
      setOpen(true);
      setError(ui.noOffices);
      return;
    }
    setSelectedOfficeId(officeId);
    setOpen(true);
    await loadAvailability(officeId);
  };

  const changeOffice = async (officeId: string) => {
    if (!officeId || officeId === selectedOfficeId) return;
    setSelectedOfficeId(officeId);
    await loadAvailability(officeId);
  };

  const change = async (action: "book" | "reschedule" | "cancel") => {
    setWorking(true);
    setError("");
    try {
      const result = await booking({
        data: {
          token,
          action,
          slot: action === "cancel" ? undefined : selected,
          officeId: action === "cancel" ? undefined : selectedOfficeId,
          serviceType: "consultation",
        },
      });
      if (result && typeof result === "object" && "error" in result && result.error === "slot_taken") {
        setError(t("apply.slotTaken"));
        setUnavailable((previous) => selected ? [...previous, selected] : previous);
        setSlots((previous) => previous.filter((slot) => slot !== selected));
        setSelected("");
        return;
      }
      if (action === "cancel") {
        setCurrent("");
        setStatus("");
      } else if (result && typeof result === "object" && "scheduled_at" in result) {
        setCurrent(typeof result.scheduled_at === "string" ? result.scheduled_at : selected);
        setStatus(typeof result.status === "string" ? result.status : "pending");
        if ("office_id" in result && typeof result.office_id === "string") setCurrentOfficeId(result.office_id);
      }
      setSelected("");
      setOpen(false);
      if (action !== "cancel") onBooked?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message === "Time unavailable" ? t("apply.slotTaken") : (message || t("apply.bookingUnavailable")));
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12" role="status" aria-label={t("apply.loadingVisit")}><Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" /></div>;
  }

  if (invalid) {
    return <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{t("apply.invalidVisitLink")}</p>;
  }

  if (current) {
    const office = offices.find((item) => item.id === currentOfficeId);
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="size-7" aria-hidden="true" /></div>
          <h3 className="text-xl font-bold">{t("apply.visitRequestedTitle", "تم إرسال طلب زيارتك")}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("apply.visitRequestedBody", "سيؤكد فريق درب موعدك ويرسل لك التفاصيل عبر واتساب.")}</p>
          <div className="mx-auto mt-5 grid max-w-sm gap-2 text-start text-sm">
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3"><CalendarDays className="size-4 shrink-0 text-primary" /><span className="font-medium">{formatDay(current, language, office?.timezone || officeTimezone)}</span></div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3"><Clock className="size-4 shrink-0 text-primary" /><span className="font-medium" dir="ltr">{formatTime(current, office?.timezone || officeTimezone)}</span></div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3"><MapPin className="size-4 shrink-0 text-primary" /><span className="font-medium">{office ? officeName(office, language) : currentOfficeId || t("apply.officeLocation")}</span></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadSlots} disabled={working}>{working ? <Loader2 className="size-4 animate-spin" /> : <CalendarDays className="size-4" />}{t("apply.changeVisit")}</Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={function () { void change("cancel"); }} disabled={working}>{t("apply.cancelVisit")}</Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {open && <BookingFlow />}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="space-y-3">
        <Button onClick={loadSlots} disabled={working || !offices.length}><CalendarDays aria-hidden="true" />{ui.book}</Button>
        {!offices.length && <p className="text-sm text-muted-foreground">{ui.noOffices}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return <BookingFlow />;

  function BookingFlow() {
    const phase = selected ? 3 : selectedDay ? 2 : selectedOfficeId ? 1 : 0;
    const stepLabels = [ui.chooseOffice, t("apply.bookingStepDate", "اختر التاريخ"), t("apply.bookingStepTime", "اختر الوقت"), t("apply.bookingStepConfirm", "التأكيد")];

    return (
      <div className="space-y-5">
        <ol className="flex items-center gap-2" aria-label={t("apply.manageVisit")}>
          {stepLabels.map((label, index) => {
            const done = index < phase;
            const active = index === phase;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span className={"flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold " + (done ? "bg-primary text-primary-foreground" : active ? "border-2 border-primary text-primary" : "border border-border text-muted-foreground")} aria-current={active ? "step" : undefined}>{done ? <Check className="size-3.5" /> : index + 1}</span>
                <span className={"hidden text-xs font-medium sm:block " + (active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                {index < stepLabels.length - 1 && <span className={"h-px flex-1 " + (done ? "bg-primary" : "bg-border")} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-4">
                <div className="flex items-center gap-2"><Building2 className="size-4 text-primary" /><p className="text-sm font-semibold">{ui.chooseOffice}</p></div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{ui.officeHelp}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {offices.map((office) => {
                  const selectedOffice = office.id === selectedOfficeId;
                  return (
                    <button
                      key={office.id}
                      type="button"
                      onClick={function () { void changeOffice(office.id); }}
                      disabled={working}
                      aria-pressed={selectedOffice}
                      className={"rounded-xl border p-4 text-start transition-all " + (selectedOffice ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/50 hover:bg-primary/5")}
                    >
                      <div className="flex items-start gap-3">
                        <span className={"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full " + (selectedOffice ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><MapPin className="size-4" /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{officeName(office, language)}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{office.city}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {!offices.length && <p className="py-4 text-sm text-muted-foreground">{ui.noOffices}</p>}
            </div>

            {selectedOfficeId && (
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDay ? localDate(selectedDay) : undefined}
                    onSelect={function (date) { if (date && days.has(dateKey(date))) { setSelectedDay(dateKey(date)); setSelected(""); } }}
                    disabled={function (date) { return !days.has(dateKey(date)); }}
                    {...(firstDay && lastDay ? { startMonth: firstDay, endMonth: lastDay } : {})}
                    locale={isAr ? ar : language.startsWith("he") ? undefined : enUS}
                    classNames={{ selected: "rounded-md bg-highlight font-bold text-highlight-foreground hover:bg-highlight hover:text-highlight-foreground focus:bg-highlight focus:text-highlight-foreground" }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary/30 ring-1 ring-primary/50" />{t("apply.legendAvailable", "متاح")}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-highlight" />{t("apply.legendSelected", "مختار")}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-muted-foreground/20" />{t("apply.legendUnavailable", "غير متاح")}</span>
                </div>
              </div>
            )}

            {selectedOfficeId && (
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="mb-3 text-sm font-semibold">{t("apply.availableTimes")}</p>
                {working && slots.length === 0 ? (
                  <div className="flex justify-center py-6" role="status"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
                ) : daySlots.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t("apply.noTimes")}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {daySlots.map(function (slot) {
                      const isSelected = selected === slot;
                      const isOpen = available.has(slot);
                      if (!isOpen) {
                        return <button key={slot} type="button" disabled aria-label={formatTime(slot, selectedTimezone) + " — " + t("apply.legendUnavailable")} className="cursor-not-allowed rounded-lg border border-dashed border-border bg-muted/40 px-2 py-2.5 text-sm tabular-nums text-muted-foreground/60 line-through" dir="ltr">{formatTime(slot, selectedTimezone)}</button>;
                      }
                      return <button key={slot} type="button" onClick={function () { setSelected(slot); }} aria-pressed={isSelected} disabled={working} className={"rounded-lg border px-2 py-2.5 text-sm font-medium tabular-nums transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " + (isSelected ? "border-highlight bg-highlight font-bold text-highlight-foreground shadow-sm" : "border-border bg-background hover:border-primary/60 hover:bg-primary/5")} dir="ltr">{formatTime(slot, selectedTimezone)}</button>;
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-4 text-sm font-semibold">{t("apply.summaryTitle", "تفاصيل الزيارة")}</p>
              {selected ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3"><CalendarDays className="size-4 shrink-0 text-primary" /><div><p className="text-[11px] text-muted-foreground">{t("apply.summaryDate", "التاريخ")}</p><p className="font-medium">{formatDay(selected, language, selectedTimezone)}</p></div></div>
                  <div className="flex items-center gap-3"><Clock className="size-4 shrink-0 text-primary" /><div><p className="text-[11px] text-muted-foreground">{t("apply.summaryTime", "الوقت")}</p><p className="font-medium" dir="ltr">{formatTime(selected, selectedTimezone)}</p></div></div>
                  <div className="flex items-center gap-3"><MapPin className="size-4 shrink-0 text-primary" /><div><p className="text-[11px] text-muted-foreground">{ui.selectedOffice}</p><p className="font-medium">{selectedOffice ? officeName(selectedOffice, language) : selectedOfficeId}</p>{selectedOffice?.address_line_1 ? <p className="mt-0.5 text-xs text-muted-foreground">{selectedOffice.address_line_1}</p> : null}</div></div>
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">{t("apply.summaryEmpty", "اختر التاريخ والوقت لعرض التفاصيل هنا.")}</p>
              )}
              <Button className="mt-5 w-full" disabled={!selected || working} onClick={function () { void change(current ? "reschedule" : "book"); }}>
                {working ? <Loader2 className="size-4 animate-spin" /> : <Check />}
                {ui.confirm}
              </Button>
            </div>

            <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-muted/40 p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><p>{t("apply.requestNotice")}</p></div>
            <button type="button" onClick={function () { setOpen(false); setSelected(""); setError(""); }} disabled={working} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><X className="size-3.5" />{t("apply.closeCalendar")}</button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </aside>
        </div>
      </div>
    );
  }
}
