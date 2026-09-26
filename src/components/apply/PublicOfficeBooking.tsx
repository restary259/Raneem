import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { managePublicBooking } from "@/lib/publicBooking.functions";

export default function PublicOfficeBooking({ token }: { token: string }) {
  const { t } = useTranslation("landing");
  const booking = useServerFn(managePublicBooking);
  const [slots, setSlots] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const label = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

  useEffect(() => {
    let live = true;
    booking({ data: { token, action: "read" } }).then((value) => {
      if (live && value && typeof value === "object" && "scheduled_at" in value) {
        setCurrent(typeof value.scheduled_at === "string" ? value.scheduled_at : "");
        setStatus(typeof value.status === "string" ? value.status : "");
      }
    }).catch(() => { if (live) setError(t("apply.bookingUnavailable")); });
    return () => { live = false; };
  }, [booking, token, t]);

  const loadSlots = async () => {
    setOpen(true);
    setWorking(true);
    setError("");
    try {
      const result = await booking({ data: { token, action: "availability" } });
      setSlots(result && typeof result === "object" && "slots" in result && Array.isArray(result.slots) ? result.slots : []);
    } catch { setError(t("apply.bookingUnavailable")); }
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
        setStatus("scheduled");
      }
      setSelected(""); setOpen(false);
    } catch { setError(t("apply.bookingUnavailable")); await loadSlots(); }
    finally { setWorking(false); }
  };

  return <div className="w-full space-y-4 text-start">
    {current && <div className="border-s-2 border-brand bg-editorial-paper p-4">
      <p className="font-semibold text-foreground">{t("apply.visitRequested")}</p>
      <p className="text-sm text-muted-foreground">{label(current)} · {t("apply.visitPending")}</p>
    </div>}
    {!open ? <Button onClick={loadSlots} variant={current ? "outline" : "default"} className="w-full" disabled={working}>
      <CalendarDays className="size-4" />{t(current ? "apply.changeVisit" : "apply.bookVisit")}
    </Button> : <div className="space-y-4">
      <p className="text-sm font-semibold">{t("apply.pickTime")}</p>
      {working ? <Loader2 className="mx-auto size-5 animate-spin" /> : slots.length ? <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {slots.map((slot) => <Button key={slot} type="button" size="sm" variant={selected === slot ? "default" : "outline"} onClick={() => setSelected(slot)} className="h-auto min-h-12 whitespace-normal text-xs" aria-pressed={selected === slot}>{label(slot)}</Button>)}
      </div> : <p className="text-sm text-muted-foreground">{t("apply.noTimes")}</p>}
      <div className="flex gap-2"><Button disabled={!selected || working} onClick={() => change(current ? "reschedule" : "book")} className="flex-1">{t("apply.requestVisit")}</Button><Button variant="ghost" onClick={() => setOpen(false)}>{t("apply.deferVisit")}</Button></div>
    </div>}
    {current && status && <Button variant="link" className="px-0 text-destructive" disabled={working} onClick={() => change("cancel")}>{t("apply.cancelVisit")}</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}