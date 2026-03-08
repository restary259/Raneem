import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  subDays,
  isToday,
  parseISO,
  getHours,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  CalendarIcon,
  Clock,
  Pencil,
  Trash2,
  User,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppointmentOutcomeModal from "@/components/team/AppointmentOutcomeModal";

/* ── Types ─────────────────────────────────────────────────────────── */
interface Appointment {
  id: string;
  case_id: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
  outcome: string | null;
  case?: { full_name: string; phone_number: string; status: string };
}
interface Case {
  id: string;
  full_name: string;
  phone_number: string;
}

/* ── Constants ──────────────────────────────────────────────────────── */
const WORK_START = 8; // 8 am
const WORK_END = 20; // 8 pm (last bookable slot = 19:xx)
const HOURS = Array.from({ length: WORK_END - WORK_START }, (_, i) => i + WORK_START);
type CalendarView = "day" | "week" | "month";

/* ── Status helpers ─────────────────────────────────────────────────── */
// Returns a labelKey (i18n key) rather than a raw string so callers can use t(s.labelKey)
const apptStyle = (outcome: string | null) => {
  if (!outcome)
    return {
      bg: "bg-violet-50 border-violet-200 text-violet-900",
      dot: "bg-violet-500",
      badge: "bg-violet-100 text-violet-700",
      labelKey: "team.appointments.statusUpcoming",
      icon: <Clock className="h-2.5 w-2.5" />,
    };
  if (outcome === "completed")
    return {
      bg: "bg-emerald-50 border-emerald-200 text-emerald-900",
      dot: "bg-emerald-500",
      badge: "bg-emerald-100 text-emerald-700",
      labelKey: "team.appointments.statusCompleted",
      icon: <CheckCircle2 className="h-2.5 w-2.5" />,
    };
  if (outcome === "no_show")
    return {
      bg: "bg-rose-50 border-rose-200 text-rose-900",
      dot: "bg-rose-500",
      badge: "bg-rose-100 text-rose-700",
      labelKey: "team.appointments.statusNoShow",
      icon: <AlertCircle className="h-2.5 w-2.5" />,
    };
  if (outcome === "rescheduled" || outcome === "delayed")
    return {
      bg: "bg-amber-50 border-amber-200 text-amber-900",
      dot: "bg-amber-500",
      badge: "bg-amber-100 text-amber-700",
      labelKey: "team.appointments.statusRescheduled",
      icon: <RefreshCw className="h-2.5 w-2.5" />,
    };
  return {
    bg: "bg-slate-50  border-slate-200  text-slate-800",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600",
    labelKey: outcome,
    icon: <CalendarIcon className="h-2.5 w-2.5" />,
  };
};

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function TeamAppointmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { i18n, t } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";

  /* ── Data ── */
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [myCases, setMyCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Calendar ── */
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");

  /* ── New / Edit modal ── */
  const [showModal, setShowModal] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newTime, setNewTime] = useState("10:00");
  const [newDuration, setNewDuration] = useState("60");
  const [newNotes, setNewNotes] = useState("");
  const [newCaseId, setNewCaseId] = useState("");
  const [manualName, setManualName] = useState("");
  const [useManualName, setUseManualName] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Detail modal ── */
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);

  /* ── Delete ── */
  const [deletingAppt, setDeletingAppt] = useState<Appointment | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /* ── Drag & Drop ── */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ day: Date; hour: number } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ appt: Appointment; newDate: Date } | null>(null);
  const [confirmingMove, setConfirmingMove] = useState(false);

  /* ══ DATA FETCHING ═══════════════════════════════════════════════════ */
  const fetchAppts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, case:cases(full_name, phone_number, status)")
        .eq("team_member_id", user.id)
        .order("scheduled_at");
      if (error) throw error;
      setAppts((data as any[]) ?? []);
    } catch (err: any) {
      console.error("fetchAppts error:", err);
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const fetchMyCases = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("cases")
        .select("id, full_name, phone_number")
        .eq("assigned_to", user.id)
        .order("full_name");
      if (error) throw error;
      setMyCases((data as Case[]) ?? []);
    } catch (err: any) {
      console.error("fetchMyCases error:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchAppts();
  }, [fetchAppts]);
  useEffect(() => {
    fetchMyCases();
  }, [fetchMyCases]);

  /* ══ DRAG & DROP ═════════════════════════════════════════════════════ */
  // Called from ApptBlock's onDragStart
  const handleDragStart = (e: React.DragEvent, apptId: string) => {
    setDraggingId(apptId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    // Enforce working hours safeguard
    if (hour < WORK_START || hour >= WORK_END) {
      e.dataTransfer.dropEffect = "none";
      return;
    }
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot({ day, hour });
  };

  const handleDrop = (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    if (!draggingId) return;

    // Working hours safeguard
    if (hour < WORK_START || hour >= WORK_END) {
      toast({ variant: "destructive", description: t("team.appointments.errDropWorkHours") });
      setDraggingId(null);
      setDragOverSlot(null);
      return;
    }

    const appt = appts.find((a) => a.id === draggingId);
    if (!appt) return;

    const newDt = new Date(day);
    newDt.setHours(hour, 0, 0, 0);
    const orig = parseISO(appt.scheduled_at);
    if (isSameDay(newDt, orig) && getHours(orig) === hour) {
      setDraggingId(null);
      setDragOverSlot(null);
      return;
    }

    // Show confirmation before saving
    setPendingMove({ appt, newDate: newDt });
    setDraggingId(null);
    setDragOverSlot(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverSlot(null);
  };

  const confirmMove = async () => {
    if (!pendingMove) return;
    setConfirmingMove(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ scheduled_at: pendingMove.newDate.toISOString() })
        .eq("id", pendingMove.appt.id);
      if (error) throw error;
      toast({ title: t("team.appointments.toastRescheduled"), description: format(pendingMove.newDate, "EEE, MMM d 'at' h:mm a") });
      setPendingMove(null);
      fetchAppts();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setConfirmingMove(false);
    }
  };

  /* ══ MODAL HELPERS ═══════════════════════════════════════════════════ */
  const openNew = (date?: Date, hour?: number) => {
    setEditingAppt(null);
    const d = date ? new Date(date) : new Date();
    if (hour !== undefined) d.setHours(hour, 0, 0, 0);
    setNewDate(d);
    setNewTime(hour !== undefined ? `${String(hour).padStart(2, "0")}:00` : "10:00");
    setNewDuration("60");
    setNewNotes("");
    setNewCaseId("");
    setManualName("");
    setUseManualName(false);
    setShowModal(true);
  };

  const openEdit = (appt: Appointment) => {
    setEditingAppt(appt);
    const dt = parseISO(appt.scheduled_at);
    setNewDate(dt);
    setNewTime(format(dt, "HH:mm"));
    setNewDuration(String(appt.duration_minutes));
    setNewNotes(appt.notes ?? "");
    setNewCaseId(appt.case_id ?? "");
    setManualName("");
    setUseManualName(false);
    setSelectedAppt(null);
    setShowModal(true);
  };

  /* ══ SAVE ════════════════════════════════════════════════════════════ */
  const handleSave = async () => {
    if (!newDate) {
      toast({ variant: "destructive", description: t("team.appointments.errNoDate") });
      return;
    }
    if (!useManualName && !newCaseId) {
      toast({ variant: "destructive", description: t("team.appointments.errNoCase") });
      return;
    }
    if (useManualName && !manualName.trim()) {
      toast({ variant: "destructive", description: t("team.appointments.errNoName") });
      return;
    }

    // Working hours validation
    const [hh] = newTime.split(":").map(Number);
    if (hh < WORK_START || hh >= WORK_END) {
      toast({ variant: "destructive", description: t("team.appointments.errWorkHours") });
      return;
    }

    setSaving(true);
    try {
      const [h, m] = newTime.split(":").map(Number);
      const dt = new Date(newDate);
      dt.setHours(h, m, 0, 0);

      if (editingAppt) {
        const { error } = await supabase
          .from("appointments")
          .update({
            scheduled_at: dt.toISOString(),
            duration_minutes: parseInt(newDuration),
            notes: newNotes || null,
            ...(newCaseId && !useManualName ? { case_id: newCaseId } : {}),
          })
          .eq("id", editingAppt.id);
        if (error) throw error;
        toast({ title: t("team.appointments.toastUpdated") });
      } else {
        let caseId = newCaseId;
        if (useManualName && manualName.trim()) {
          const { data: cd, error: ce } = await supabase
            .from("cases")
            .insert({
              full_name: manualName.trim(),
              assigned_to: user!.id,
              phone_number: "",
              status: "appointment_scheduled",
            })
            .select("id")
            .single();
          if (ce) throw ce;
          caseId = (cd as any).id;
        }
        const { error } = await supabase.from("appointments").insert({
          case_id: caseId,
          team_member_id: user!.id,
          scheduled_at: dt.toISOString(),
          duration_minutes: parseInt(newDuration),
          notes: newNotes || null,
        });
        if (error) throw error;
        if (!useManualName) {
          await supabase
            .from("cases")
            .update({ status: "appointment_scheduled" })
            .eq("id", caseId)
            .eq("status", "contacted");
        }
        toast({ title: t("team.appointments.toastCreated") });
      }
      setShowModal(false);
      setEditingAppt(null);
      fetchAppts();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  /* ══ DELETE ══════════════════════════════════════════════════════════ */
  const handleDelete = async () => {
    if (!deletingAppt) return;
    setConfirmingDelete(true);
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", deletingAppt.id);
      if (error) throw error;
      toast({ title: t("team.appointments.toastDeleted") });
      setDeletingAppt(null);
      setSelectedAppt(null);
      fetchAppts();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setConfirmingDelete(false);
    }
  };

  /* ══ NAVIGATION ══════════════════════════════════════════════════════ */
  const navigatePrev = () => {
    if (view === "day") setCurrentDate((d) => subDays(d, 1));
    else if (view === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };
  const navigateNext = () => {
    if (view === "day") setCurrentDate((d) => addDays(d, 1));
    else if (view === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };

  /* ══ CALENDAR HELPERS ════════════════════════════════════════════════ */
  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 0 }),
    end: endOfWeek(currentDate, { weekStartsOn: 0 }),
  });
  const monthWeeks = eachWeekOfInterval(
    { start: startOfMonth(currentDate), end: endOfMonth(currentDate) },
    { weekStartsOn: 0 },
  );
  const getSlot = (day: Date, hour: number) =>
    appts.filter((a) => {
      const d = parseISO(a.scheduled_at);
      return isSameDay(d, day) && getHours(d) === hour;
    });
  const getDay = (day: Date) => appts.filter((a) => isSameDay(parseISO(a.scheduled_at), day));
  const calLocale = isAr ? "ar-SA" : "en-US";
  const headerLabel =
    view === "day"
      ? currentDate.toLocaleDateString(calLocale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : view === "week"
        ? `${weekDays[0].toLocaleDateString(calLocale, { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString(calLocale, { month: "short", day: "numeric", year: "numeric" })}`
        : currentDate.toLocaleDateString(calLocale, { month: "long", year: "numeric" });

  /* ══ APPOINTMENT BLOCK ═══════════════════════════════════════════════
     draggable={true} always. Browser guarantees: real drag → no click fires.
     So onClick safely opens detail with zero extra logic needed.
  ═══════════════════════════════════════════════════════════════════════ */
  const ApptBlock = ({ appt, compact = false }: { appt: Appointment; compact?: boolean }) => {
    const s = apptStyle(appt.outcome);
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          handleDragStart(e, appt.id);
        }}
        onDragEnd={(e) => {
          e.stopPropagation();
          handleDragEnd();
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAppt(appt);
        }}
        className={cn(
          "rounded-lg border select-none transition-all duration-150",
          s.bg,
          draggingId === appt.id
            ? "opacity-40 scale-95 cursor-grabbing"
            : "cursor-grab hover:shadow-sm hover:scale-[1.01] active:cursor-grabbing",
          compact ? "text-[9px] px-1.5 py-0.5 mb-0.5" : "text-[11px] p-1.5 mb-1",
        )}
      >
        <div className="flex items-center gap-1 min-w-0">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
          <span className="font-semibold truncate">{(appt.case as any)?.full_name ?? "—"}</span>
        </div>
        {!compact && (
          <div className="flex items-center gap-1 mt-0.5 opacity-65 pl-2.5">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            <span>{format(parseISO(appt.scheduled_at), "h:mm a")}</span>
            <span className="opacity-70">· {appt.duration_minutes}m</span>
          </div>
        )}
      </div>
    );
  };

  /* ══ RENDER ══════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            className="text-sm font-semibold min-w-[200px] text-center hover:text-primary transition-colors"
            onClick={() => setCurrentDate(new Date())}
          >
            {headerLabel}
          </button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 px-3 rounded-full"
            onClick={() => setCurrentDate(new Date())}
          >
            {t("team.appointments.navToday")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
            {(["day", "week", "month"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-all capitalize",
                  view === v
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "day" ? t("team.appointments.viewDay") : v === "week" ? t("team.appointments.viewWeek") : t("team.appointments.viewMonth")}
              </button>
            ))}
          </div>
          <Button size="sm" className="gap-1.5 rounded-full px-4 h-8 shadow-sm" onClick={() => openNew()}>
            <Plus className="h-3.5 w-3.5" />
            {t("team.appointments.newAppointment")}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ══ DAY VIEW ══ */}
      {!loading && view === "day" && (
        <div className="flex-1 overflow-auto">
          <div className="min-w-[400px]">
            <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-2.5">
              <div
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
                  isToday(currentDate) ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {currentDate.toLocaleDateString(calLocale, { weekday: "long", month: "long", day: "numeric" })}
                {isToday(currentDate) && <span className="text-xs opacity-80">{t("team.appointments.todayPill")}</span>}
              </div>
            </div>
            {HOURS.map((hour) => {
              const slotAppts = getSlot(currentDate, hour);
              const isOver = dragOverSlot && isSameDay(dragOverSlot.day, currentDate) && dragOverSlot.hour === hour;
              return (
                <div
                  key={hour}
                  className={cn(
                    "grid border-b border-border/40 min-h-[72px] transition-colors",
                    isOver ? "bg-violet-50" : "hover:bg-muted/15",
                  )}
                  style={{ gridTemplateColumns: "64px 1fr" }}
                  onDragOver={(e) => handleDragOver(e, currentDate, hour)}
                  onDrop={(e) => handleDrop(e, currentDate, hour)}
                  onDragLeave={() => setDragOverSlot(null)}
                  onClick={() => openNew(currentDate, hour)}
                >
                  <div className="py-2 px-3 text-xs text-muted-foreground shrink-0 flex items-start pt-2.5 border-r border-border/40 select-none">
                    {new Date().setHours(hour, 0, 0, 0) && new Date(new Date().setHours(hour, 0, 0, 0)).toLocaleTimeString(calLocale, { hour: "numeric", hour12: true })}
                  </div>
                  <div className="p-1.5 cursor-pointer">
                    {isOver && (
                      <div className="text-[10px] text-violet-600 font-medium mb-1">{t("team.appointments.dropSchedule")}</div>
                    )}
                    {slotAppts.map((a) => (
                      <ApptBlock key={a.id} appt={a} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ WEEK VIEW ══ */}
      {!loading && view === "week" && (
        <div className="flex-1 overflow-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div
              className="sticky top-0 z-10 bg-background border-b border-border grid"
              style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}
            >
              <div className="border-r border-border/40" />
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "py-2 px-1 text-center border-r border-border/40 last:border-r-0",
                    isToday(day) && "bg-violet-50/50",
                  )}
                >
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{day.toLocaleDateString(calLocale, { weekday: "short" })}</div>
                  <div
                    className={cn(
                      "text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5 cursor-pointer transition-colors",
                      isToday(day) ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                    onClick={() => {
                      setCurrentDate(day);
                      setView("day");
                    }}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>
            {/* Hour rows */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid border-b border-border/30 min-h-[64px]"
                style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}
              >
                <div className="py-1 px-3 text-xs text-muted-foreground border-r border-border/40 flex items-start pt-2 shrink-0 select-none">
                  {new Date(new Date().setHours(hour, 0, 0, 0)).toLocaleTimeString(calLocale, { hour: "numeric", hour12: true })}
                </div>
                {weekDays.map((day) => {
                  const slotAppts = getSlot(day, hour);
                  const isOver = dragOverSlot && isSameDay(dragOverSlot.day, day) && dragOverSlot.hour === hour;
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "border-r border-border/30 last:border-r-0 p-0.5 relative transition-colors cursor-pointer",
                        isToday(day) && "bg-violet-50/25",
                        isOver ? "bg-violet-100/70" : "hover:bg-muted/20",
                      )}
                      onDragOver={(e) => handleDragOver(e, day, hour)}
                      onDrop={(e) => handleDrop(e, day, hour)}
                      onDragLeave={() => setDragOverSlot(null)}
                      onClick={() => openNew(day, hour)}
                    >
                      {isOver && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <div className="text-[9px] text-violet-600 font-semibold bg-violet-50 border border-violet-200 rounded-md px-1.5 py-0.5">
                            {t("team.appointments.dropHere")}
                          </div>
                        </div>
                      )}
                      {slotAppts.map((a) => (
                        <ApptBlock key={a.id} appt={a} />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ MONTH VIEW ══ */}
      {!loading && view === "month" && (
        <div className="flex-1 overflow-auto p-3">
          <div className="grid grid-cols-7 mb-1">
            {[
              t("team.appointments.dayAbbrevSun"),
              t("team.appointments.dayAbbrevMon"),
              t("team.appointments.dayAbbrevTue"),
              t("team.appointments.dayAbbrevWed"),
              t("team.appointments.dayAbbrevThu"),
              t("team.appointments.dayAbbrevFri"),
              t("team.appointments.dayAbbrevSat"),
            ].map((d) => (
              <div
                key={d}
                className="text-[10px] text-center text-muted-foreground font-semibold uppercase tracking-wide py-1"
              >
                {d}
              </div>
            ))}
          </div>
          {monthWeeks.map((weekStart) => {
            const wDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 0 }) });
            return (
              <div key={weekStart.toISOString()} className="grid grid-cols-7 border-t border-border/40">
                {wDays.map((day) => {
                  const dayAppts = getDay(day);
                  const isOver = dragOverSlot && isSameDay(dragOverSlot.day, day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[100px] border-r border-border/30 last:border-r-0 p-1.5 transition-colors cursor-pointer",
                        !isSameMonth(day, currentDate) && "opacity-35 bg-muted/10",
                        isToday(day) && "bg-violet-50/40",
                        isOver ? "bg-violet-100/50" : "hover:bg-muted/15",
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverSlot({ day, hour: 9 });
                      }}
                      onDrop={(e) => handleDrop(e, day, 9)}
                      onDragLeave={() => setDragOverSlot(null)}
                      onClick={() => openNew(day)}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 mx-auto transition-colors",
                          isToday(day) ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentDate(day);
                          setView("day");
                        }}
                      >
                        {format(day, "d")}
                      </div>
                      {dayAppts.slice(0, 3).map((a) => (
                        <ApptBlock key={a.id} appt={a} compact />
                      ))}
                      {dayAppts.length > 3 && (
                        <p className="text-[9px] text-muted-foreground text-center font-medium mt-0.5">
                          {t("team.appointments.moreCount", { n: dayAppts.length - 3 })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ NEW / EDIT MODAL ══ */}
      <Dialog
        open={showModal}
        onOpenChange={(v) => {
          if (!v) {
            setShowModal(false);
            setEditingAppt(null);
          }
        }}
      >
        <DialogContent className="max-w-md" dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              </span>
              {editingAppt ? t("team.appointments.editTitle") : t("team.appointments.newTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Student */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("team.appointments.labelStudent")}</Label>
              {!useManualName ? (
                <div className="flex gap-2">
                  <Select value={newCaseId} onValueChange={setNewCaseId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t("team.appointments.placeholderCase")} />
                    </SelectTrigger>
                    <SelectContent>
                      {myCases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-medium">{c.full_name}</span>
                          {c.phone_number && (
                            <span className="text-muted-foreground ml-2 text-xs">{c.phone_number}</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="shrink-0 text-xs gap-1"
                    onClick={() => {
                      setUseManualName(true);
                      setNewCaseId("");
                    }}
                  >
                    <User className="h-3 w-3" /> {t("team.appointments.manualBtn")}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder={t("team.appointments.placeholderManualName")}
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" type="button" onClick={() => setUseManualName(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("team.appointments.labelDate")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start font-normal", !newDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="me-2 h-4 w-4" />
                      {newDate ? format(newDate, "MMM d, yyyy") : t("team.appointments.placeholderDate")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newDate}
                      onSelect={setNewDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("team.appointments.labelTime")} <span className="text-muted-foreground/60 normal-case font-normal">{t("team.appointments.labelTimeRange")}</span>
                </Label>
                <Input
                  type="time"
                  value={newTime}
                  min="08:00"
                  max="19:59"
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("team.appointments.labelDuration")}
              </Label>
              <div className="flex gap-1.5">
                {[
                  ["30", "30m"],
                  ["45", "45m"],
                  ["60", "1h"],
                  ["90", "1.5h"],
                  ["120", "2h"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setNewDuration(val)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all",
                      newDuration === val
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> {t("team.appointments.labelNotes")}
              </Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder={t("team.appointments.placeholderNotes")}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingAppt(null);
              }}
            >
              {t("team.appointments.btnCancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving} type="button">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingAppt ? t("team.appointments.btnSaveChanges") : t("team.appointments.btnCreate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ DETAIL MODAL ══ */}
      <Dialog
        open={!!selectedAppt && !showModal}
        onOpenChange={(v) => {
          if (!v) setSelectedAppt(null);
        }}
      >
        <DialogContent className="max-w-sm" dir={isAr ? 'rtl' : 'ltr'}>
          {selectedAppt &&
            (() => {
              const s = apptStyle(selectedAppt.outcome);
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-start gap-3">
                      <span className={cn("w-2 h-10 rounded-full shrink-0 mt-0.5", s.dot)} />
                      <div className="flex-1 min-w-0">
                        <DialogTitle className="truncate">{(selectedAppt.case as any)?.full_name ?? "—"}</DialogTitle>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full mt-1",
                            s.badge,
                          )}
                        >
                          {s.icon} {t(s.labelKey)}
                        </span>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <CalendarIcon className="h-4 w-4 shrink-0 text-primary/70" />
                      <span>{format(parseISO(selectedAppt.scheduled_at), "EEEE, MMMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0 text-primary/70" />
                      <span>
                        {format(parseISO(selectedAppt.scheduled_at), "h:mm a")} · {selectedAppt.duration_minutes} min
                      </span>
                    </div>
                    {selectedAppt.notes && (
                      <div className="bg-muted/40 rounded-lg p-3 border border-border/40">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {t("team.appointments.labelNotes")}
                        </p>
                        <p className="text-sm text-foreground/80 leading-relaxed">{selectedAppt.notes}</p>
                      </div>
                    )}
                  </div>
                  <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <div className="flex gap-2 flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => openEdit(selectedAppt)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> {t("team.appointments.btnEdit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
                        onClick={() => {
                          setDeletingAppt(selectedAppt);
                          setSelectedAppt(null);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t("team.appointments.btnDelete")}
                      </Button>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/team/cases/${selectedAppt.case_id}`)}>
                      {t("team.appointments.btnViewCase")}
                    </Button>
                    {!selectedAppt.outcome && new Date(selectedAppt.scheduled_at) < new Date() && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setOutcomeApptId(selectedAppt.id);
                          setSelectedAppt(null);
                        }}
                      >
                        {t("team.appointments.btnRecordOutcome")}
                      </Button>
                    )}
                  </DialogFooter>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* ══ RESCHEDULE CONFIRM ══ */}
      <Dialog
        open={!!pendingMove}
        onOpenChange={(v) => {
          if (!v) setPendingMove(null);
        }}
      >
        <DialogContent className="max-w-sm" dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t("team.appointments.rescheduleTitle")}</DialogTitle>
          </DialogHeader>
          {pendingMove && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {t("team.appointments.rescheduleMoveText", { name: (pendingMove.appt.case as any)?.full_name })}
              </p>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 font-semibold text-center text-base">
                {format(pendingMove.newDate, "EEEE, MMMM d 'at' h:mm a")}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {t("team.appointments.rescheduleOldDate", { date: format(parseISO(pendingMove.appt.scheduled_at), "EEE, MMM d 'at' h:mm a") })}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMove(null)}>
              {t("team.appointments.btnCancel")}
            </Button>
            <Button onClick={confirmMove} disabled={confirmingMove}>
              {confirmingMove ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {t("team.appointments.btnConfirmReschedule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ DELETE CONFIRM ══ */}
      <Dialog
        open={!!deletingAppt}
        onOpenChange={(v) => {
          if (!v) setDeletingAppt(null);
        }}
      >
        <DialogContent className="max-w-sm" dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t("team.appointments.deleteTitle")}</DialogTitle>
          </DialogHeader>
          {deletingAppt && (
            <p className="text-sm text-muted-foreground">
              {t("team.appointments.deleteBody", {
                name: (deletingAppt.case as any)?.full_name,
                date: format(parseISO(deletingAppt.scheduled_at), "MMM d 'at' h:mm a"),
              })}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingAppt(null)}>
              {t("team.appointments.btnCancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={confirmingDelete}>
              {confirmingDelete ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t("team.appointments.btnConfirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outcome modal */}
      {outcomeApptId && (
        <AppointmentOutcomeModal
          open={!!outcomeApptId}
          onClose={() => setOutcomeApptId(null)}
          appointmentId={outcomeApptId}
          onSuccess={fetchAppts}
        />
      )}
    </div>
  );
}
