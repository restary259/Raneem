import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Clock,
  GripVertical,
  Phone,
  ExternalLink,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppointmentOutcomeModal from "@/components/team/AppointmentOutcomeModal";

interface Appointment {
  id: string;
  case_id: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
  outcome: string | null;
  case?: { full_name: string; phone_number: string; status: string } | null;
}

interface Case {
  id: string;
  full_name: string;
  phone_number: string;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8am–8pm

// 30-min quick slots for the time picker
const QUICK_TIMES = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
];

type CalendarView = "day" | "week" | "month";

// ── Color helpers ────────────────────────────────────────────────────────────
function apptClasses(outcome: string | null, isPast: boolean) {
  if (outcome === "completed") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (outcome === "no_show") return "bg-red-100 text-red-800 border-red-300";
  if (outcome === "cancelled") return "bg-slate-100 text-slate-600 border-slate-300";
  if (outcome === "rescheduled") return "bg-blue-100 text-blue-800 border-blue-300";
  if (outcome === "delayed") return "bg-amber-100 text-amber-800 border-amber-300";
  if (isPast) return "bg-orange-100 text-orange-800 border-orange-400 ring-1 ring-orange-300";
  return "bg-indigo-100 text-indigo-800 border-indigo-300";
}

export default function TeamAppointmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";

  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [deleteApptId, setDeleteApptId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // New appointment form
  const [showNew, setShowNew] = useState(false);
  const [newDateStr, setNewDateStr] = useState(""); // "yyyy-MM-dd"
  const [newTime, setNewTime] = useState("10:00");
  const [newDuration, setNewDuration] = useState("60");
  const [newNotes, setNewNotes] = useState("");
  const [newCaseId, setNewCaseId] = useState("");
  const [myCases, setMyCases] = useState<Case[]>([]);
  const [creating, setCreating] = useState(false);

  // Drag-and-drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ day: Date; hour: number } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ appt: Appointment; newDate: Date } | null>(null);
  const [confirmingMove, setConfirmingMove] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────────
  const fetchAppts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("*, case:cases(full_name, phone_number, status)")
      .eq("team_member_id", user.id)
      .order("scheduled_at");
    setAppts((data as any[]) ?? []);
    setLoading(false);
  }, [user]);

  const fetchMyCases = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("cases")
      .select("id, full_name, phone_number")
      .eq("assigned_to", user.id)
      .order("full_name");
    setMyCases((data as Case[]) ?? []);
  }, [user]);

  useEffect(() => {
    fetchAppts();
  }, [fetchAppts]);
  useEffect(() => {
    fetchMyCases();
  }, [fetchMyCases]);

  // ── Drag handlers ───────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, apptId: string) => {
    setDraggingId(apptId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot({ day, hour });
  };
  const handleDrop = (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    if (!draggingId) return;
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
      toast({ title: "Appointment rescheduled", description: format(pendingMove.newDate, "EEE, MMM d 'at' h:mm a") });
      setPendingMove(null);
      fetchAppts();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setConfirmingMove(false);
    }
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
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

  const headerLabel = () => {
    if (view === "day") return format(currentDate, "EEEE, MMM d, yyyy");
    if (view === "week") {
      const s = startOfWeek(currentDate, { weekStartsOn: 0 });
      const e = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  };

  // ── Slot helpers ────────────────────────────────────────────────────────────
  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 0 }),
    end: endOfWeek(currentDate, { weekStartsOn: 0 }),
  });
  const getSlotAppts = (day: Date, hour: number) =>
    appts.filter((a) => {
      const d = parseISO(a.scheduled_at);
      return isSameDay(d, day) && getHours(d) === hour;
    });
  const getDayAppts = (day: Date) => appts.filter((a) => isSameDay(parseISO(a.scheduled_at), day));
  const monthWeeks = eachWeekOfInterval(
    { start: startOfMonth(currentDate), end: endOfMonth(currentDate) },
    { weekStartsOn: 0 },
  );

  // 7 date pills around currentDate for the quick date selector
  const datePills = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), i));

  // ── Open new appt pre-filled ─────────────────────────────────────────────
  const openNew = (day?: Date, hour?: number) => {
    setNewDateStr(format(day ?? new Date(), "yyyy-MM-dd"));
    if (hour !== undefined) setNewTime(`${String(hour).padStart(2, "0")}:00`);
    setShowNew(true);
  };

  const resetNewForm = () => {
    setNewDateStr("");
    setNewTime("10:00");
    setNewDuration("60");
    setNewNotes("");
    setNewCaseId("");
  };

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newCaseId || !newDateStr) {
      toast({ variant: "destructive", description: "Select a case and date" });
      return;
    }
    setCreating(true);
    try {
      const [hh, mm] = newTime.split(":").map(Number);
      const dt = new Date(newDateStr);
      dt.setHours(hh, mm, 0, 0);
      const { error } = await supabase.from("appointments").insert({
        case_id: newCaseId,
        team_member_id: user!.id,
        scheduled_at: dt.toISOString(),
        duration_minutes: parseInt(newDuration),
        notes: newNotes || null,
      });
      if (error) throw error;
      await supabase
        .from("cases")
        .update({ status: "appointment_scheduled" })
        .eq("id", newCaseId)
        .eq("status", "contacted");
      toast({ title: "Appointment created" });
      setShowNew(false);
      resetNewForm();
      fetchAppts();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setCreating(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteApptId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", deleteApptId);
      if (error) throw error;
      toast({ title: "Appointment deleted" });
      setDeleteApptId(null);
      setSelectedAppt(null);
      fetchAppts();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const overdueCount = appts.filter((a) => !a.outcome && new Date(a.scheduled_at) < new Date()).length;

  // ── Shared hour-grid (Day + Week) ───────────────────────────────────────────
  const HourGrid = ({ days }: { days: Date[] }) => (
    <div className="flex-1 overflow-auto">
      <div style={{ minWidth: days.length === 1 ? "320px" : "680px" }}>
        {/* Day headers */}
        <div
          className="grid border-b border-border sticky top-0 bg-background z-10"
          style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}
        >
          <div className="border-e border-border" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "py-2 px-1 text-center border-e border-border last:border-e-0",
                isToday(day) && "bg-primary/5",
              )}
            >
              <div className="text-[11px] text-muted-foreground font-medium">
                {format(day, days.length === 1 ? "EEEE" : "EEE")}
              </div>
              <div
                className={cn(
                  "text-sm font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5",
                  isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground",
                )}
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
            className="grid border-b border-border/40 min-h-[60px]"
            style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}
          >
            <div className="py-1 px-1.5 text-[10px] text-muted-foreground border-e border-border flex items-start pt-2 shrink-0 tabular-nums">
              {format(new Date().setHours(hour, 0, 0, 0), "h a")}
            </div>
            {days.map((day) => {
              const slotAppts = getSlotAppts(day, hour);
              const isOver = dragOverSlot && isSameDay(dragOverSlot.day, day) && dragOverSlot.hour === hour;
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-e border-border/40 last:border-e-0 p-0.5 relative transition-colors",
                    isToday(day) && "bg-primary/[0.02]",
                    isOver && "bg-indigo-50 border-indigo-300",
                    "hover:bg-muted/30 cursor-pointer",
                  )}
                  onDragOver={(e) => handleDragOver(e, day, hour)}
                  onDrop={(e) => handleDrop(e, day, hour)}
                  onDragLeave={() => setDragOverSlot(null)}
                  onClick={() => openNew(day, hour)}
                >
                  {isOver && draggingId && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className="text-[10px] text-indigo-600 font-medium bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">
                        Drop to reschedule
                      </div>
                    </div>
                  )}
                  {slotAppts.map((a) => {
                    const isPast = new Date(a.scheduled_at) < new Date();
                    return (
                      <div
                        key={a.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleDragStart(e, a.id);
                        }}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAppt(a);
                        }}
                        className={cn(
                          "text-[10px] p-1 rounded mb-0.5 cursor-grab active:cursor-grabbing border leading-tight select-none transition-opacity hover:shadow-sm",
                          apptClasses(a.outcome, isPast),
                          draggingId === a.id && "opacity-40",
                        )}
                      >
                        <div className="flex items-center gap-0.5">
                          <GripVertical className="h-2.5 w-2.5 opacity-40 shrink-0" />
                          <span className="font-semibold truncate">{(a.case as any)?.full_name ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-70 mt-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {format(parseISO(a.scheduled_at), "h:mm a")} · {a.duration_minutes}m
                        </div>
                        {isPast && !a.outcome && (
                          <div className="text-[9px] font-bold text-orange-700 mt-0.5">⚠ Needs outcome</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[150px] text-center">{headerLabel()}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 border border-orange-300 rounded-full px-2 py-0.5">
              <AlertCircle className="h-3 w-3" />
              {overdueCount} overdue
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(["day", "week", "month"] as CalendarView[]).map((v, i) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 font-medium transition-colors capitalize",
                  i < 2 && "border-e border-border",
                  view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => openNew()}>
            <Plus className="h-4 w-4 me-1" />
            {isAr ? "جديد" : "New"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── DAY VIEW ── */}
          {view === "day" && <HourGrid days={[currentDate]} />}

          {/* ── WEEK VIEW ── */}
          {view === "week" && <HourGrid days={weekDays} />}

          {/* ── MONTH VIEW ── */}
          {view === "month" && (
            <div className="flex-1 overflow-auto p-2">
              <div className="grid grid-cols-7 mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    className="text-[11px] text-center text-muted-foreground font-semibold py-1 uppercase tracking-wide"
                  >
                    {d}
                  </div>
                ))}
              </div>
              {monthWeeks.map((weekStart) => {
                const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 0 }) });
                return (
                  <div key={weekStart.toISOString()} className="grid grid-cols-7 border-t border-border/40">
                    {days.map((day) => {
                      const dayAppts = getDayAppts(day);
                      const inMonth = isSameMonth(day, currentDate);
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "min-h-[96px] border-e border-border/40 last:border-e-0 p-1 cursor-pointer transition-colors",
                            !inMonth && "opacity-35 bg-muted/10",
                            isToday(day) && "bg-primary/[0.04]",
                            "hover:bg-accent/20",
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
                              "w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1",
                              isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground",
                            )}
                          >
                            {format(day, "d")}
                          </div>
                          {dayAppts.slice(0, 3).map((a) => {
                            const isPast = new Date(a.scheduled_at) < new Date();
                            return (
                              <div
                                key={a.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  handleDragStart(e, a.id);
                                }}
                                onDragEnd={handleDragEnd}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppt(a);
                                }}
                                className={cn(
                                  "text-[9px] px-1 py-0.5 rounded mb-0.5 truncate cursor-grab border font-medium leading-tight",
                                  apptClasses(a.outcome, isPast),
                                )}
                              >
                                {format(parseISO(a.scheduled_at), "h:mm")} {(a.case as any)?.full_name}
                              </div>
                            );
                          })}
                          {dayAppts.length > 3 && (
                            <p className="text-[9px] text-muted-foreground text-center">+{dayAppts.length - 3} more</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── NEW APPOINTMENT DIALOG ──────────────────────────────────────────── */}
      <Dialog
        open={showNew}
        onOpenChange={(v) => {
          if (!v) {
            setShowNew(false);
            resetNewForm();
          } else setShowNew(true);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">New Appointment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Case */}
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Case <span className="text-destructive">*</span>
              </Label>
              <Select value={newCaseId} onValueChange={setNewCaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select case…" />
                </SelectTrigger>
                <SelectContent>
                  {myCases.length === 0 ? (
                    <div className="py-3 text-center text-sm text-muted-foreground">No cases assigned</div>
                  ) : (
                    myCases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-medium">{c.full_name}</span>
                        <span className="ms-1.5 text-muted-foreground text-xs">{c.phone_number}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Date — native input (clean, keyboard-friendly) */}
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Date <span className="text-destructive">*</span>
              </Label>
              {/* Quick "this week" pills */}
              <div className="flex gap-1 mb-2 flex-wrap">
                {datePills.map((d) => (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => setNewDateStr(format(d, "yyyy-MM-dd"))}
                    className={cn(
                      "flex flex-col items-center px-2 py-1 rounded-lg border text-[10px] font-medium transition-colors min-w-[36px]",
                      newDateStr === format(d, "yyyy-MM-dd")
                        ? "bg-primary text-primary-foreground border-primary"
                        : isToday(d)
                          ? "border-primary/50 text-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-accent text-muted-foreground",
                    )}
                  >
                    <span className="uppercase">{format(d, "EEE")}</span>
                    <span className="text-[11px] font-bold">{format(d, "d")}</span>
                  </button>
                ))}
              </div>
              <Input
                type="date"
                value={newDateStr}
                onChange={(e) => setNewDateStr(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Time — quick buttons + manual input */}
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Time <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {QUICK_TIMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewTime(t)}
                    className={cn(
                      "text-[10px] py-1 rounded border font-medium transition-colors",
                      newTime === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/40 hover:bg-accent text-muted-foreground",
                    )}
                  >
                    {t.replace(":00", "").replace(":30", ":30")}
                  </button>
                ))}
              </div>
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="text-sm" />
            </div>

            {/* Duration */}
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Duration
              </Label>
              <div className="flex gap-1.5 flex-wrap">
                {["30", "45", "60", "90", "120"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setNewDuration(d)}
                    className={cn(
                      "px-3 py-1.5 rounded border text-xs font-medium transition-colors",
                      newDuration === d
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/40 hover:bg-accent text-muted-foreground",
                    )}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Optional…"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNew(false);
                resetNewForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── APPOINTMENT DETAIL DIALOG ───────────────────────────────────────── */}
      <Dialog open={!!selectedAppt} onOpenChange={(v) => !v && setSelectedAppt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>{(selectedAppt?.case as any)?.full_name ?? "—"}</span>
              {selectedAppt?.outcome ? (
                <Badge className={cn("text-xs", apptClasses(selectedAppt.outcome, false))}>
                  {selectedAppt.outcome.replace(/_/g, " ")}
                </Badge>
              ) : new Date(selectedAppt?.scheduled_at ?? "") < new Date() ? (
                <Badge className="text-xs bg-orange-100 text-orange-700 border border-orange-300">⚠ Overdue</Badge>
              ) : (
                <Badge className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-300">Upcoming</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedAppt && (
            <div className="space-y-3 text-sm">
              {/* Date & time block */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                <div className="text-center bg-background border border-border rounded-lg px-2 py-1 min-w-[40px]">
                  <div className="text-[10px] text-muted-foreground uppercase font-medium">
                    {format(parseISO(selectedAppt.scheduled_at), "MMM")}
                  </div>
                  <div className="text-xl font-black leading-none text-foreground">
                    {format(parseISO(selectedAppt.scheduled_at), "d")}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{format(parseISO(selectedAppt.scheduled_at), "EEEE")}</p>
                  <p className="text-muted-foreground text-xs">
                    {format(parseISO(selectedAppt.scheduled_at), "h:mm a")} · {selectedAppt.duration_minutes} min
                  </p>
                </div>
              </div>

              {/* Phone */}
              {(selectedAppt.case as any)?.phone_number && (
                <a
                  href={`tel:${(selectedAppt.case as any).phone_number}`}
                  className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 hover:bg-emerald-100 transition-colors"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium text-xs">{(selectedAppt.case as any).phone_number}</span>
                </a>
              )}

              {/* Notes */}
              {selectedAppt.notes && (
                <p className="text-muted-foreground text-xs bg-muted/30 rounded-lg px-3 py-2 border border-border whitespace-pre-wrap">
                  {selectedAppt.notes}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-wrap gap-2 mt-2">
            {/* Delete — far left */}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive me-auto"
              onClick={() => setDeleteApptId(selectedAppt!.id)}
            >
              <Trash2 className="h-3.5 w-3.5 me-1" /> Delete
            </Button>

            {/* View Case */}
            <Button variant="outline" size="sm" onClick={() => navigate(`/team/cases/${selectedAppt?.case_id}`)}>
              <ExternalLink className="h-3.5 w-3.5 me-1" /> Case
            </Button>

            {/* Record Outcome */}
            {selectedAppt && !selectedAppt.outcome && (
              <Button
                size="sm"
                onClick={() => {
                  setOutcomeApptId(selectedAppt.id);
                  setSelectedAppt(null);
                }}
              >
                Record Outcome
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DRAG CONFIRM ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!pendingMove}
        onOpenChange={(v) => {
          if (!v) setPendingMove(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment?</DialogTitle>
          </DialogHeader>
          {pendingMove && (
            <div className="text-sm space-y-3">
              <p className="text-muted-foreground">
                Move <strong>{(pendingMove.appt.case as any)?.full_name}</strong> to:
              </p>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 font-semibold text-center">
                {format(pendingMove.newDate, "EEEE, MMM d 'at' h:mm a")}
              </div>
              <p className="text-xs text-muted-foreground">
                Was: {format(parseISO(pendingMove.appt.scheduled_at), "EEE, MMM d 'at' h:mm a")}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMove(null)}>
              Cancel
            </Button>
            <Button onClick={confirmMove} disabled={confirmingMove}>
              {confirmingMove ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM ──────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteApptId} onOpenChange={(v) => !v && setDeleteApptId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Appointment
            </AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── OUTCOME MODAL ───────────────────────────────────────────────────── */}
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
