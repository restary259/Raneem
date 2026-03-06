import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  isToday,
  parseISO,
  getHours,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  setHours,
  setMinutes,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Loader2, CalendarIcon, Clock, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppointmentOutcomeModal from "@/components/team/AppointmentOutcomeModal";

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

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8am–8pm

type CalendarView = "week" | "month";

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

  // New appointment
  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newTime, setNewTime] = useState("10:00");
  const [newDuration, setNewDuration] = useState("60");
  const [newNotes, setNewNotes] = useState("");
  const [newCaseId, setNewCaseId] = useState("");
  const [myCases, setMyCases] = useState<Case[]>([]);
  const [creating, setCreating] = useState(false);

  // Drag-and-drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ day: Date; hour: number } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ appt: Appointment; newDate: Date } | null>(null);
  const [confirmingMove, setConfirmingMove] = useState(false);

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

  // ── Drag handlers ──
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
    // Check if actually a different time
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

  // ── Week view helpers ──
  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 0 }),
    end: endOfWeek(currentDate, { weekStartsOn: 0 }),
  });
  const getApptsForSlot = (day: Date, hour: number) =>
    appts.filter((a) => {
      const d = parseISO(a.scheduled_at);
      return isSameDay(d, day) && getHours(d) === hour;
    });

  // ── Month view helpers ──
  const monthWeeks = eachWeekOfInterval(
    { start: startOfMonth(currentDate), end: endOfMonth(currentDate) },
    { weekStartsOn: 0 },
  );
  const getApptsForDay = (day: Date) => appts.filter((a) => isSameDay(parseISO(a.scheduled_at), day));

  // ── New appointment ──
  const handleCreateAppointment = async () => {
    if (!newCaseId || !newDate) {
      toast({
        variant: "destructive",
        description: isAr ? "يرجى تحديد الملف والتاريخ" : "Please select case and date",
      });
      return;
    }
    setCreating(true);
    try {
      const [hh, mm] = newTime.split(":").map(Number);
      const dt = new Date(newDate);
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
      toast({ title: isAr ? "تم إنشاء الموعد" : "Appointment created" });
      setShowNew(false);
      setNewDate(undefined);
      setNewTime("10:00");
      setNewNotes("");
      setNewCaseId("");
      fetchAppts();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const apptColor = (outcome: string | null) => {
    if (!outcome) return "bg-indigo-100 text-indigo-800 border-indigo-200";
    if (outcome === "completed") return "bg-green-100 text-green-800 border-green-200";
    if (outcome === "no_show") return "bg-red-100 text-red-800 border-red-200";
    if (outcome === "rescheduled") return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-muted text-muted-foreground border-border";
  };

  const navigate_prev = () =>
    view === "week" ? setCurrentDate((d) => subWeeks(d, 1)) : setCurrentDate((d) => subMonths(d, 1));
  const navigate_next = () =>
    view === "week" ? setCurrentDate((d) => addWeeks(d, 1)) : setCurrentDate((d) => addMonths(d, 1));
  const weekLabel =
    view === "week"
      ? `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`
      : format(currentDate, "MMMM yyyy");

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigate_prev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[160px] text-center">{weekLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigate_next}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setView("week")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                view === "week" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              Week
            </button>
            <button
              onClick={() => setView("month")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors border-l border-border",
                view === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              Month
            </button>
          </div>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 me-1" />
            {isAr ? "موعد جديد" : "New"}
          </Button>
        </div>
      </div>

      {/* ── WEEK VIEW ── */}
      {view === "week" && (
        <div className="flex-1 overflow-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-background z-10">
              <div className="py-2 px-2 text-xs text-muted-foreground border-e border-border" />
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "py-2 px-1 text-center border-e border-border last:border-e-0",
                    isToday(day) && "bg-primary/5",
                  )}
                >
                  <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                  <div
                    className={cn(
                      "text-sm font-medium mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5",
                      isToday(day) && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>
            {/* Hour rows */}
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-border/50 min-h-[64px]">
                <div className="py-1 px-2 text-xs text-muted-foreground border-e border-border flex items-start pt-2 shrink-0">
                  {format(new Date().setHours(hour, 0, 0, 0), "h a")}
                </div>
                {weekDays.map((day) => {
                  const slotAppts = getApptsForSlot(day, hour);
                  const isOver = dragOverSlot && isSameDay(dragOverSlot.day, day) && dragOverSlot.hour === hour;
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "border-e border-border/50 last:border-e-0 p-0.5 relative transition-colors",
                        isToday(day) && "bg-primary/3",
                        isOver && "bg-indigo-50 border-indigo-300",
                        "hover:bg-muted/30 cursor-pointer",
                      )}
                      onDragOver={(e) => handleDragOver(e, day, hour)}
                      onDrop={(e) => handleDrop(e, day, hour)}
                      onDragLeave={() => setDragOverSlot(null)}
                      onClick={() => {
                        const d = new Date(day);
                        d.setHours(hour, 0, 0, 0);
                        setNewDate(d);
                        setNewTime(`${String(hour).padStart(2, "0")}:00`);
                        setShowNew(true);
                      }}
                    >
                      {isOver && draggingId && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <div className="text-[10px] text-indigo-600 font-medium bg-indigo-50 rounded px-1">
                            Drop here
                          </div>
                        </div>
                      )}
                      {slotAppts.map((a) => (
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
                            "text-[10px] p-1 rounded mb-0.5 cursor-grab active:cursor-grabbing border leading-tight select-none transition-opacity",
                            apptColor(a.outcome),
                            draggingId === a.id && "opacity-40",
                          )}
                        >
                          <div className="flex items-center gap-0.5">
                            <GripVertical className="h-2.5 w-2.5 opacity-50 shrink-0" />
                            <span className="font-medium truncate">{(a.case as any)?.full_name ?? "—"}</span>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-70 mt-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {format(parseISO(a.scheduled_at), "h:mm a")}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MONTH VIEW ── */}
      {view === "month" && (
        <div className="flex-1 overflow-auto p-2">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-xs text-center text-muted-foreground font-medium py-1">
                {d}
              </div>
            ))}
          </div>
          {/* Weeks */}
          {monthWeeks.map((weekStart) => {
            const weekDaysM = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 0 }) });
            return (
              <div key={weekStart.toISOString()} className="grid grid-cols-7 border-t border-border/50">
                {weekDaysM.map((day) => {
                  const dayAppts = getApptsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[90px] border-e border-border/50 last:border-e-0 p-1 cursor-pointer hover:bg-muted/30 transition-colors",
                        !isCurrentMonth && "opacity-40 bg-muted/20",
                        isToday(day) && "bg-primary/5",
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverSlot({ day, hour: 9 });
                      }}
                      onDrop={(e) => handleDrop(e, day, 9)}
                      onDragLeave={() => setDragOverSlot(null)}
                      onClick={() => {
                        setNewDate(day);
                        setShowNew(true);
                      }}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 mx-auto",
                          isToday(day) && "bg-primary text-primary-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </div>
                      {dayAppts.slice(0, 3).map((a) => (
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
                            "text-[9px] px-1 py-0.5 rounded mb-0.5 truncate cursor-grab border leading-tight",
                            apptColor(a.outcome),
                          )}
                        >
                          {format(parseISO(a.scheduled_at), "h:mm a")} {(a.case as any)?.full_name}
                        </div>
                      ))}
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

      {/* New Appointment Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? "موعد جديد" : "New Appointment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isAr ? "الملف *" : "Case *"}</Label>
              <Select value={newCaseId} onValueChange={setNewCaseId}>
                <SelectTrigger>
                  <SelectValue placeholder={isAr ? "اختر الملف" : "Select case"} />
                </SelectTrigger>
                <SelectContent>
                  {myCases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} — {c.phone_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isAr ? "التاريخ *" : "Date *"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
                        !newDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="me-2 h-4 w-4" />
                      {newDate ? format(newDate, "PP") : isAr ? "اختر" : "Pick"}
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
              <div>
                <Label className="mb-1 block">{isAr ? "الوقت *" : "Time *"}</Label>
                <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{isAr ? "المدة" : "Duration"}</Label>
              <Select value={newDuration} onValueChange={setNewDuration}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["30", "45", "60", "90", "120"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d} {isAr ? "دقيقة" : "min"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isAr ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                className="mt-1"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder={isAr ? "ملاحظات اختيارية..." : "Optional notes..."}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreateAppointment} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : isAr ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={!!selectedAppt} onOpenChange={() => setSelectedAppt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{(selectedAppt?.case as any)?.full_name ?? "—"}</DialogTitle>
          </DialogHeader>
          {selectedAppt && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                {format(parseISO(selectedAppt.scheduled_at), "PPP p")}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {selectedAppt.duration_minutes} min
              </div>
              {selectedAppt.notes && <p className="text-muted-foreground">{selectedAppt.notes}</p>}
              {selectedAppt.outcome && (
                <Badge className={apptColor(selectedAppt.outcome)}>{selectedAppt.outcome}</Badge>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => navigate(`/team/cases/${selectedAppt?.case_id}`)}>
              View Case
            </Button>
            {selectedAppt && !selectedAppt.outcome && new Date(selectedAppt.scheduled_at) < new Date() && (
              <Button
                variant="destructive"
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

      {/* Drag-and-drop confirmation dialog */}
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
                Move appointment for <strong>{(pendingMove.appt.case as any)?.full_name}</strong> to:
              </p>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 font-medium text-center">
                {format(pendingMove.newDate, "EEEE, MMMM d 'at' h:mm a")}
              </div>
              <p className="text-xs text-muted-foreground">
                Original: {format(parseISO(pendingMove.appt.scheduled_at), "EEE, MMM d 'at' h:mm a")}
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
