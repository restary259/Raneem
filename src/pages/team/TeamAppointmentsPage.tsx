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
  Phone,
  ExternalLink,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  UserX,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppointmentOutcomeModal from "@/components/team/AppointmentOutcomeModal";

interface Appointment {
  id: string;
  case_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
  outcome: string | null;
  guest_name?: string | null;
  case?: { full_name: string; phone_number: string; status: string } | null;
}

interface Case {
  id: string;
  full_name: string;
  phone_number: string;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am–8pm

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

const OUTCOME_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  completed: { label: "Completed", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  no_show: { label: "No Show", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  cancelled: { label: "Cancelled", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
  rescheduled: { label: "Rescheduled", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  delayed: { label: "Delayed", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

function apptStyle(outcome: string | null, isPast: boolean) {
  if (outcome && OUTCOME_CONFIG[outcome]) {
    const c = OUTCOME_CONFIG[outcome];
    return { bg: c.bg, text: c.text, border: c.border };
  }
  if (isPast && !outcome) {
    return { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-400" };
  }
  return { bg: "bg-indigo-50", text: "text-indigo-800", border: "border-indigo-300" };
}

function ApptBlock({ appt, compact = false, onClick }: { appt: Appointment; compact?: boolean; onClick: () => void }) {
  const isPast = new Date(appt.scheduled_at) < new Date();
  const style = apptStyle(appt.outcome, isPast);
  const name = (appt.case as any)?.full_name ?? (appt as any).guest_name ?? "—";
  const overdue = isPast && !appt.outcome;
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "rounded border leading-tight select-none cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]",
        compact ? "text-[10px] p-1 mb-0.5" : "text-xs p-1.5 mb-1",
        style.bg,
        style.text,
        style.border,
        overdue && "ring-1 ring-amber-400",
      )}
    >
      <div className="font-semibold truncate">{name}</div>
      {!compact && (
        <div className="flex items-center gap-1 opacity-70 mt-0.5">
          <Clock className="h-2.5 w-2.5" />
          {format(parseISO(appt.scheduled_at), "h:mm a")} · {appt.duration_minutes}m
        </div>
      )}
      {compact && <div className="opacity-70">{format(parseISO(appt.scheduled_at), "h:mm a")}</div>}
      {overdue && !compact && (
        <div className="mt-0.5 text-[9px] font-bold text-amber-700 uppercase tracking-wide">⚠ Needs outcome</div>
      )}
    </div>
  );
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

  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("10:00");
  const [newDuration, setNewDuration] = useState("60");
  const [newNotes, setNewNotes] = useState("");
  const [newCaseId, setNewCaseId] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [useGuestName, setUseGuestName] = useState(false);
  const [myCases, setMyCases] = useState<Case[]>([]);
  const [creating, setCreating] = useState(false);

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
    if (view === "day") return format(currentDate, "EEEE, MMMM d, yyyy");
    if (view === "week") {
      const s = startOfWeek(currentDate, { weekStartsOn: 0 });
      const e = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 0 }),
    end: endOfWeek(currentDate, { weekStartsOn: 0 }),
  });
  const getApptsForSlot = (day: Date, hour: number) =>
    appts.filter((a) => {
      const d = parseISO(a.scheduled_at);
      return isSameDay(d, day) && getHours(d) === hour;
    });
  const getApptsForDay = (day: Date) => appts.filter((a) => isSameDay(parseISO(a.scheduled_at), day));
  const monthWeeks = eachWeekOfInterval(
    { start: startOfMonth(currentDate), end: endOfMonth(currentDate) },
    { weekStartsOn: 0 },
  );

  const openNew = (date?: Date, hour?: number) => {
    if (date) setNewDate(format(date, "yyyy-MM-dd"));
    if (hour !== undefined) setNewTime(`${String(hour).padStart(2, "0")}:00`);
    setShowNew(true);
  };

  const resetNewForm = () => {
    setNewDate("");
    setNewTime("10:00");
    setNewDuration("60");
    setNewNotes("");
    setNewCaseId("");
    setNewGuestName("");
    setUseGuestName(false);
  };

  const handleCreate = async () => {
    if (!newDate) {
      toast({ variant: "destructive", description: "Please select a date" });
      return;
    }
    if (!useGuestName && !newCaseId) {
      toast({ variant: "destructive", description: "Select a case or enter a name" });
      return;
    }
    if (useGuestName && !newGuestName.trim()) {
      toast({ variant: "destructive", description: "Enter a name" });
      return;
    }
    setCreating(true);
    try {
      const [hh, mm] = newTime.split(":").map(Number);
      const dt = new Date(newDate);
      dt.setHours(hh, mm, 0, 0);
      const payload: any = {
        team_member_id: user!.id,
        scheduled_at: dt.toISOString(),
        duration_minutes: parseInt(newDuration),
        notes: newNotes || null,
      };
      if (useGuestName) {
        payload.guest_name = newGuestName.trim();
      } else {
        payload.case_id = newCaseId;
      }
      const { error } = await supabase.from("appointments").insert(payload);
      if (error) throw error;
      if (!useGuestName && newCaseId) {
        await supabase
          .from("cases")
          .update({ status: "appointment_scheduled" })
          .eq("id", newCaseId)
          .eq("status", "contacted");
      }
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

  // Shared hour grid for day + week views
  const HourGrid = ({ days }: { days: Date[] }) => (
    <div className="flex-1 overflow-auto">
      <div style={{ minWidth: days.length === 1 ? "360px" : "680px" }}>
        <div
          className="grid border-b border-border sticky top-0 bg-background z-10"
          style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}
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
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid border-b border-border/40 min-h-[56px]"
            style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}
          >
            <div className="py-1 px-1.5 text-[10px] text-muted-foreground border-e border-border flex items-start pt-1.5 shrink-0 tabular-nums">
              {format(new Date().setHours(hour, 0, 0, 0), "h a")}
            </div>
            {days.map((day) => {
              const slotAppts = getApptsForSlot(day, hour);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-e border-border/40 last:border-e-0 p-0.5 relative",
                    isToday(day) && "bg-primary/[0.02]",
                    "hover:bg-accent/30 cursor-pointer transition-colors",
                  )}
                  onClick={() => openNew(day, hour)}
                >
                  {slotAppts.map((a) => (
                    <ApptBlock key={a.id} appt={a} compact={days.length > 3} onClick={() => setSelectedAppt(a)} />
                  ))}
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
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[140px] text-center">{headerLabel()}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5">
              <AlertCircle className="h-3 w-3" />
              {overdueCount} overdue
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(["day", "week", "month"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 font-medium transition-colors capitalize border-e border-border last:border-e-0",
                  view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => openNew()}>
            <Plus className="h-4 w-4 me-1" />
            New
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {view === "day" && <HourGrid days={[currentDate]} />}
          {view === "week" && <HourGrid days={weekDays} />}
          {view === "month" && (
            <div className="flex-1 overflow-auto p-3">
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
                      const dayAppts = getApptsForDay(day);
                      const inMonth = isSameMonth(day, currentDate);
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "min-h-[100px] border-e border-border/40 last:border-e-0 p-1 cursor-pointer transition-colors",
                            !inMonth && "opacity-35 bg-muted/10",
                            isToday(day) && "bg-primary/[0.04]",
                            "hover:bg-accent/20",
                          )}
                          onClick={() => {
                            setView("day");
                            setCurrentDate(day);
                          }}
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
                            const style = apptStyle(a.outcome, isPast);
                            const name = (a.case as any)?.full_name ?? (a as any).guest_name ?? "—";
                            return (
                              <div
                                key={a.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppt(a);
                                }}
                                className={cn(
                                  "text-[9px] px-1 py-0.5 rounded mb-0.5 truncate cursor-pointer border font-medium",
                                  style.bg,
                                  style.text,
                                  style.border,
                                )}
                              >
                                {format(parseISO(a.scheduled_at), "h:mm")} {name}
                              </div>
                            );
                          })}
                          {dayAppts.length > 3 && (
                            <p className="text-[9px] text-muted-foreground text-center font-medium">
                              +{dayAppts.length - 3} more
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
        </>
      )}

      {/* New Appointment Dialog */}
      <Dialog
        open={showNew}
        onOpenChange={(v) => {
          if (!v) {
            setShowNew(false);
            resetNewForm();
          } else setShowNew(true);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              New Appointment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Case / guest toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>
                  {useGuestName ? "Guest Name" : "Case"} <span className="text-destructive">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setUseGuestName((v) => !v);
                    setNewCaseId("");
                    setNewGuestName("");
                  }}
                  className="text-xs text-primary underline underline-offset-2 hover:no-underline"
                >
                  {useGuestName ? "← Pick from cases" : "No case? Enter name →"}
                </button>
              </div>
              {useGuestName ? (
                <Input
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  placeholder="e.g. Ahmad Karimi"
                  autoFocus
                />
              ) : (
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
                          {c.full_name}
                          <span className="ms-1 text-muted-foreground text-xs">{c.phone_number}</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Date */}
            <div>
              <Label className="mb-1 block">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>

            {/* Quick time buttons */}
            <div>
              <Label className="mb-1.5 block">
                Time <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-7 gap-1 mb-1.5">
                {QUICK_TIMES.slice(0, 14).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewTime(t)}
                    className={cn(
                      "text-[10px] py-1 rounded border font-medium transition-colors",
                      newTime === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent text-muted-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1.5">
                {QUICK_TIMES.slice(14).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewTime(t)}
                    className={cn(
                      "text-[10px] py-1 rounded border font-medium transition-colors",
                      newTime === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent text-muted-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="text-sm" />
            </div>

            {/* Duration quick buttons */}
            <div>
              <Label className="mb-1.5 block">Duration</Label>
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
                        : "border-border hover:border-primary/50 hover:bg-accent text-muted-foreground",
                    )}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="mb-1 block">Notes</Label>
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

      {/* Appointment detail dialog */}
      <Dialog open={!!selectedAppt} onOpenChange={(v) => !v && setSelectedAppt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {(selectedAppt?.case as any)?.full_name ?? (selectedAppt as any)?.guest_name ?? "—"}
              {selectedAppt?.outcome && OUTCOME_CONFIG[selectedAppt.outcome] && (
                <Badge
                  className={cn(
                    "text-xs ms-auto",
                    OUTCOME_CONFIG[selectedAppt.outcome].bg,
                    OUTCOME_CONFIG[selectedAppt.outcome].text,
                    OUTCOME_CONFIG[selectedAppt.outcome].border,
                  )}
                >
                  {OUTCOME_CONFIG[selectedAppt.outcome].label}
                </Badge>
              )}
              {!selectedAppt?.outcome && new Date(selectedAppt?.scheduled_at ?? "") < new Date() && (
                <Badge className="text-xs ms-auto bg-amber-100 text-amber-700 border-amber-300">⚠ Overdue</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedAppt && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-medium">{format(parseISO(selectedAppt.scheduled_at), "EEEE, MMMM d, yyyy")}</p>
                  <p className="text-muted-foreground text-xs">
                    {format(parseISO(selectedAppt.scheduled_at), "h:mm a")} · {selectedAppt.duration_minutes} min
                  </p>
                </div>
              </div>
              {(selectedAppt.case as any)?.phone_number && (
                <a
                  href={`tel:${(selectedAppt.case as any).phone_number}`}
                  className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 hover:bg-emerald-100 transition-colors"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium text-xs">{(selectedAppt.case as any).phone_number}</span>
                </a>
              )}
              {selectedAppt.notes && (
                <p className="text-muted-foreground text-xs bg-muted/30 rounded-lg px-3 py-2 border border-border">
                  {selectedAppt.notes}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive me-auto"
              onClick={() => setDeleteApptId(selectedAppt!.id)}
            >
              <Trash2 className="h-3.5 w-3.5 me-1" /> Delete
            </Button>
            {selectedAppt?.case_id && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/team/cases/${selectedAppt.case_id}`)}>
                <ExternalLink className="h-3.5 w-3.5 me-1" /> View Case
              </Button>
            )}
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteApptId} onOpenChange={(v) => !v && setDeleteApptId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Appointment
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The appointment will be permanently removed.
            </AlertDialogDescription>
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
