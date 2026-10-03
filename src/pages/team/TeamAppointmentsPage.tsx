import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import AppointmentActionMenu from "@/components/team/AppointmentActionMenu";
import { useOfficeWorkspaceContext } from "@/components/office/OfficeWorkspaceLayout";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toneClasses, type StatusTone } from "@/lib/statusTokens";
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
  Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppointmentOutcomeModal from "@/components/team/AppointmentOutcomeModal";
import ReassignAppointment from "@/components/team/ReassignAppointment";

/* ── Types ─────────────────────────────────────────────────────────── */
interface Appointment {
  id: string;
  case_id: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
  outcome: string | null;
  office_id?: string | null;
  public_booking?: boolean;
  confirmation_status?: string;
  case?: { full_name: string; phone_number: string; status: string };
}

interface OfficeSummary {
  id: string;
  name_ar: string;
  name_en: string;
  name_he: string;
  city: string;
  timezone: string | null;
}
interface Case {
  id: string;
  full_name: string;
  phone_number: string;
}

/* ── Constants ──────────────────────────────────────────────────────── */
// Fallback only. The calendar window is derived from the member's office
// opening hours so it cannot contradict the public booking engine, which uses
// office_hours as the source of truth.
const DEFAULT_WORK_START = 8;
const DEFAULT_WORK_END = 20;
type CalendarView = "day" | "week" | "month";

type OfficeHoursRow = {
  office_id: string;
  weekday: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
};

function hourFromTime(value: string | null): number | null {
  if (!value) return null;
  const hour = Number(String(value).split(":")[0]);
  return Number.isFinite(hour) ? hour : null;
}

/**
 * Earliest open hour and latest close hour across the given office hours. When
 * an office is in context, only that office's hours count so the calendar
 * window matches the slots the public booking engine offers for it.
 */
function officeHourRange(
  rows: OfficeHoursRow[],
  officeId?: string,
): { start: number; end: number } {
  let start = 24;
  let end = 0;
  let any = false;
  for (const row of rows) {
    if (officeId && row.office_id !== officeId) continue;
    if (!row.is_open) continue;
    const open = hourFromTime(row.open_time);
    const close = hourFromTime(row.close_time);
    if (open === null || close === null) continue;
    any = true;
    start = Math.min(start, open);
    end = Math.max(end, close);
  }
  if (!any) return { start: DEFAULT_WORK_START, end: DEFAULT_WORK_END };
  const safeStart = Math.max(0, Math.min(start, 23));
  return { start: safeStart, end: Math.max(safeStart + 1, Math.min(24, end)) };
}

/* ── Timezone-aware slot helpers ────────────────────────────────────────
   Appointments are stored as UTC instants but belong to an office's local
   wall clock. Computing a slot's calendar day/hour with browser-local `Date`
   shifts every appointment when staff sit in a different timezone than the
   office they manage (e.g. a manager in Germany editing an Israel calendar).
   These helpers translate through the office's IANA zone instead. */

/**
 * Which calendar day/hour a UTC instant falls on in the given IANA timezone.
 * The returned `date` is a *local-constructed* carrier (`new Date(y, m, d)`)
 * so date-fns local getters (`isSameDay`, `format`) read the office-local
 * civil date regardless of the browser zone.
 */
function zonedParts(
  instant: Date,
  timeZone: string,
): { date: Date; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    date: new Date(get("year"), get("month") - 1, get("day")),
    // `hour` can report 24 at midnight in some locales; normalise to 0.
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

/**
 * Convert an office-local wall clock (a `Date` whose Y/M/D and the H/M below
 * are meant literally in `timeZone`) into the true UTC instant. Uses the
 * two-pass offset correction so DST boundaries resolve correctly.
 */
function zonedWallTimeToUtc(
  day: Date,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hour,
    minute,
  );
  let guess = wall;
  for (let i = 0; i < 2; i += 1) {
    const { date, hour: h, minute: m } = zonedParts(new Date(guess), timeZone);
    const observed = Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      h,
      m,
    );
    guess += wall - observed;
  }
  return new Date(guess);
}

/* ── Status helpers ─────────────────────────────────────────────────── */
// Returns a labelKey (i18n key) rather than a raw string so callers can use t(s.labelKey)
const apptStyle = (outcome: string | null) => {
  const tone = ((): StatusTone => {
    if (!outcome) return "appointment";
    if (outcome === "completed") return "enrolled";
    if (outcome === "no_show") return "danger";
    if (outcome === "rescheduled" || outcome === "delayed") return "payment";
    return "neutral";
  })();
  const tc = toneClasses(tone);
  const labelKey = !outcome
    ? "team.appointments.statusUpcoming"
    : outcome === "completed"
      ? "team.appointments.statusCompleted"
      : outcome === "no_show"
        ? "team.appointments.statusNoShow"
        : outcome === "rescheduled" || outcome === "delayed"
          ? "team.appointments.statusRescheduled"
          : outcome;
  const icon = !outcome ? (
    <Clock className="h-2.5 w-2.5" />
  ) : outcome === "completed" ? (
    <CheckCircle2 className="h-2.5 w-2.5" />
  ) : outcome === "no_show" ? (
    <AlertCircle className="h-2.5 w-2.5" />
  ) : outcome === "rescheduled" || outcome === "delayed" ? (
    <RefreshCw className="h-2.5 w-2.5" />
  ) : (
    <CalendarIcon className="h-2.5 w-2.5" />
  );
  return {
    bg: `${tc.tint} border ${tc.text}`,
    dot: tc.dot,
    badge: tc.chip,
    labelKey,
    icon,
  };
};

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function TeamAppointmentsPage() {
  const workspaceContext = useOfficeWorkspaceContext();
  // Inside an office workspace the layout resolved the slug to a uuid and
  // authorized the caller; scope the calendar to that office. The cross-office
  // `/team/appointments` route has no provider, so `officeId` stays undefined.
  const officeId = workspaceContext?.officeId;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { i18n, t } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";

  /* ── Data ── */
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [visitRequests, setVisitRequests] = useState<Appointment[]>([]);
  const [confirmingVisit, setConfirmingVisit] = useState<string | null>(null);
  const [myCases, setMyCases] = useState<Case[]>([]);
  const [myOffices, setMyOffices] = useState<OfficeSummary[]>([]);
  const [officeHours, setOfficeHours] = useState<OfficeHoursRow[]>([]);
  const [officeNames, setOfficeNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // The calendar window follows office opening hours instead of a fixed 8–20,
  // so it always agrees with the slots the public booking engine offers.
  const { start: WORK_START, end: WORK_END } = useMemo(
    () => officeHourRange(officeHours, officeId),
    [officeHours, officeId],
  );
  const HOURS = useMemo(
    () =>
      Array.from(
        { length: Math.max(1, WORK_END - WORK_START) },
        (_, i) => i + WORK_START,
      ),
    [WORK_START, WORK_END],
  );

  // The office whose wall clock the calendar speaks. The workspace context is
  // authoritative when present; otherwise fall back to the focused office's row
  // or the browser zone (cross-office view with no office selected).
  const activeTimezone = useMemo(() => {
    const fromContext = workspaceContext?.context.office.timezone;
    if (fromContext) return fromContext;
    const row = myOffices.find((o) => o.id === officeId);
    return row?.timezone || undefined;
  }, [workspaceContext, myOffices, officeId]);

  // Day/hour of a UTC instant in the active office zone (falls back to browser).
  const zonedDay = useCallback(
    (instant: Date) =>
      activeTimezone ? zonedParts(instant, activeTimezone).date : instant,
    [activeTimezone],
  );
  const zonedHour = useCallback(
    (instant: Date) =>
      activeTimezone
        ? zonedParts(instant, activeTimezone).hour
        : getHours(instant),
    [activeTimezone],
  );
  // Office-local wall clock → UTC instant. Without a resolved zone this is the
  // previous browser-local behaviour.
  const wallTimeToUtc = useCallback(
    (day: Date, hour: number, minute: number) =>
      activeTimezone
        ? zonedWallTimeToUtc(day, hour, minute, activeTimezone)
        : new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            hour,
            minute,
          ),
    [activeTimezone],
  );

  /* ── Calendar ── */
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches
      ? "day"
      : "week",
  );

  /* ── New / Edit modal ── */
  const [showModal, setShowModal] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newTime, setNewTime] = useState("10:00");
  const [newDuration, setNewDuration] = useState("60");
  const [newNotes, setNewNotes] = useState("");
  const [newCaseId, setNewCaseId] = useState("");
  const [newOfficeId, setNewOfficeId] = useState("");
  const [manualName, setManualName] = useState("");
  const [useManualName, setUseManualName] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Detail modal ── */
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  // Push reminders deep-link to /team/appointments?appointment=<id>; open it once loaded.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || loading || typeof window === "undefined")
      return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("appointment");
    if (!id) return;
    deepLinkHandled.current = true;
    const open = (match: Appointment) => {
      setCurrentDate(new Date(match.scheduled_at));
      setSelectedAppt(match);
    };
    params.delete("appointment");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`,
    );
    const local = appts.find((a) => a.id === id);
    if (local) {
      open(local);
      return;
    }
    // Not in the loaded list (e.g. older) — fetch that single row (RLS applies).
    supabase
      .from("appointments")
      .select("*, case:cases(full_name, phone_number, status)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn("[appointments] deep link fetch failed", error.message);
          return;
        }
        if (data) open(data as unknown as Appointment);
      });
  }, [appts, loading]);
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);

  /* ── Delete ── */
  const [deletingAppt, setDeletingAppt] = useState<Appointment | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /* ── Drag & Drop ── */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{
    day: Date;
    hour: number;
  } | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    appt: Appointment;
    newDate: Date;
  } | null>(null);
  const [confirmingMove, setConfirmingMove] = useState(false);

  /* ══ DATA FETCHING ═══════════════════════════════════════════════════ */
  const fetchAppts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const cutoff = subDays(new Date(), 1).toISOString(); // keep yesterday visible, hide older
      let query = supabase
        .from("appointments")
        .select("*, case:cases(full_name, phone_number, status)")
        .eq("team_member_id", user.id)
        // future/recent OR still pending an outcome (safety net so a missed
        // outcome never disappears just because the slot has passed)
        .or(`scheduled_at.gte.${cutoff},outcome.is.null`);
      // Inside an office workspace the calendar shows only that office's
      // appointments; outside it, the member's full book across offices.
      if (officeId) query = query.eq("office_id", officeId);
      const { data, error } = await query.order("scheduled_at");
      if (error) throw error;
      const appointmentRows = ((data as any[]) ?? []).filter(
        (row) => !officeId || row.office_id === officeId,
      );
      setAppts(appointmentRows);
      const appointmentOfficeIds = [
        ...new Set(appointmentRows.map((row) => row.office_id).filter(Boolean)),
      ] as string[];
      const officeLookupResult = appointmentOfficeIds.length
        ? await (supabase.from as any)("offices")
            .select("id,name_ar,name_en,name_he,city")
            .in("id", appointmentOfficeIds)
        : { data: [], error: null };
      if (officeLookupResult.error) throw officeLookupResult.error;
      const officeMap: Record<string, string> = {};
      (officeLookupResult.data ?? []).forEach((office: OfficeSummary) => {
        officeMap[office.id] = isAr
          ? office.name_ar
          : i18n.language.startsWith("he")
            ? office.name_he || office.name_en
            : office.name_en;
      });
      setOfficeNames(officeMap);
      let requestQuery = supabase
        .from("appointments")
        .select(
          "*, case:cases!inner(full_name, phone_number, status, assigned_to)",
        )
        .eq("case.assigned_to", user.id)
        .eq("public_booking", true)
        .eq("confirmation_status", "pending")
        .is("outcome", null)
        .gte("scheduled_at", new Date().toISOString());
      if (officeId) requestQuery = requestQuery.eq("office_id", officeId);
      const { data: requested, error: requestError } =
        await requestQuery.order("scheduled_at");
      if (requestError) throw requestError;
      setVisitRequests((requested as Appointment[]) ?? []);
    } catch (err: any) {
      console.error("fetchAppts error:", err);
      toast({ variant: "destructive", description: t("common.error") });
    } finally {
      setLoading(false);
    }
  }, [user, toast, i18n.language, officeId]);

  const confirmVisit = async (id: string) => {
    setConfirmingVisit(id);
    try {
      const { error } = await supabase.rpc("confirm_public_appointment", {
        p_appointment_id: id,
      });
      if (error) throw error;
      toast({ title: t("team.appointments.visitConfirmed") });
      await fetchAppts();
    } catch (err) {
      toast({ variant: "destructive", description: apptErrorMessage(err) });
    } finally {
      setConfirmingVisit(null);
    }
  };

  /*
   * The database blocks double-booking a team member. Translate that specific
   * failure into a message the user can act on instead of a generic error.
   */
  const apptErrorMessage = useCallback(
    (err: any) =>
      /APPT_BLOCKED|Time unavailable/i.test(String(err?.message ?? ""))
        ? t("team.appointments.errConflict")
        : t("common.error"),
    [t],
  );

  const fetchMyOffices = useCallback(async () => {
    if (!user) return;
    try {
      const { data: membershipRows, error: membershipError } = await (
        supabase.from as any
      )("office_members")
        .select("office_id")
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (membershipError) throw membershipError;
      const ids = [
        ...new Set(
          (membershipRows ?? [])
            .map((row: any) => row.office_id)
            .filter(Boolean),
        ),
      ] as string[];
      // In an office workspace an admin may not be a member of the office, so
      // ensure the focused office's own hours are queried too.
      const hourIds =
        officeId && !ids.includes(officeId) ? [...ids, officeId] : ids;
      if (!ids.length && !officeId) {
        setMyOffices([]);
        setOfficeHours([]);
        return;
      }
      const [officeRes, hoursRes] = await Promise.all([
        ids.length
          ? (supabase.from as any)("offices")
              .select("id,name_ar,name_en,name_he,city,timezone")
              .in("id", ids)
              .eq("is_active", true)
              .is("deleted_at", null)
          : Promise.resolve({ data: [], error: null }),
        hourIds.length
          ? (supabase.from as any)("office_hours")
              .select("office_id,weekday,is_open,open_time,close_time")
              .in("office_id", hourIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (officeRes.error) throw officeRes.error;
      if (hoursRes.error) throw hoursRes.error;
      setMyOffices((officeRes.data ?? []) as OfficeSummary[]);
      setOfficeHours((hoursRes.data ?? []) as OfficeHoursRow[]);
    } catch (err) {
      console.error("fetchMyOffices error:", err);
    }
  }, [user, officeId]);

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
    fetchMyOffices();
  }, [fetchMyCases, fetchMyOffices]);

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
      toast({
        variant: "destructive",
        description: t("team.appointments.errDropWorkHours"),
      });
      setDraggingId(null);
      setDragOverSlot(null);
      return;
    }

    const appt = appts.find((a) => a.id === draggingId);
    if (!appt) return;

    const orig = parseISO(appt.scheduled_at);
    // Compare in office-local terms, then carry the *wall clock* through the
    // UTC conversion so the drop lands on the hour the user sees.
    if (isSameDay(zonedDay(orig), day) && zonedHour(orig) === hour) {
      setDraggingId(null);
      setDragOverSlot(null);
      return;
    }
    const newDt = wallTimeToUtc(day, hour, 0);

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
      toast({
        title: t("team.appointments.toastRescheduled"),
        description: format(
          zonedCarrier(pendingMove.newDate),
          "EEE, MMM d 'at' h:mm a",
        ),
      });
      setPendingMove(null);
      fetchAppts();
    } catch (err: any) {
      console.error("confirmMove error:", err);
      toast({ variant: "destructive", description: apptErrorMessage(err) });
    } finally {
      setConfirmingMove(false);
    }
  };

  /* ══ MODAL HELPERS ═══════════════════════════════════════════════════ */
  const openNew = (date?: Date, hour?: number) => {
    setEditingAppt(null);
    // Keep only the Y/M/D (the clicked grid day is already in office-local
    // terms); the wall clock comes from `newTime` and is converted on save.
    const base = date ?? new Date();
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    setNewDate(d);
    setNewTime(
      hour !== undefined ? `${String(hour).padStart(2, "0")}:00` : "10:00",
    );
    setNewDuration("60");
    setNewNotes("");
    setNewCaseId("");
    setNewOfficeId(myOffices.length === 1 ? myOffices[0].id : "");
    setManualName("");
    setUseManualName(false);
    setShowModal(true);
  };

  const openEdit = (appt: Appointment) => {
    setEditingAppt(appt);
    const dt = parseISO(appt.scheduled_at);
    // Prefill the modal with the office-local date/time, not the browser's.
    const parts = activeTimezone
      ? zonedParts(dt, activeTimezone)
      : {
          date: new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()),
          hour: dt.getHours(),
          minute: dt.getMinutes(),
        };
    setNewDate(parts.date);
    setNewTime(
      `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
    );
    setNewDuration(String(appt.duration_minutes));
    setNewNotes(appt.notes ?? "");
    setNewCaseId(appt.case_id ?? "");
    setNewOfficeId(appt.office_id ?? "");
    setManualName("");
    setUseManualName(false);
    setSelectedAppt(null);
    setShowModal(true);
  };

  /* ══ SAVE ════════════════════════════════════════════════════════════ */
  const handleSave = async () => {
    if (!newDate) {
      toast({
        variant: "destructive",
        description: t("team.appointments.errNoDate"),
      });
      return;
    }
    if (!useManualName && !newCaseId) {
      toast({
        variant: "destructive",
        description: t("team.appointments.errNoCase"),
      });
      return;
    }
    if (useManualName && !manualName.trim()) {
      toast({
        variant: "destructive",
        description: t("team.appointments.errNoName"),
      });
      return;
    }
    if (!newOfficeId) {
      toast({
        variant: "destructive",
        description: isAr
          ? "اختار المكتب"
          : i18n.language.startsWith("he")
            ? "יש לבחור משרד"
            : "Select an office",
      });
      return;
    }

    // Working hours validation
    const [hh] = newTime.split(":").map(Number);
    if (hh < WORK_START || hh >= WORK_END) {
      toast({
        variant: "destructive",
        description: t("team.appointments.errWorkHours"),
      });
      return;
    }

    setSaving(true);
    try {
      const [h, m] = newTime.split(":").map(Number);
      // `newDate` carries the office-local Y/M/D; `newTime` the office-local
      // wall clock. Convert that pair to the true UTC instant so the stored
      // value matches the office calendar, not the browser's zone.
      const dt = wallTimeToUtc(newDate, h, m);

      if (editingAppt) {
        const { error } = await (supabase.from as any)("appointments")
          .update({
            office_id: newOfficeId,
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
          const { data: cd, error: ce } = await (supabase.from as any)("cases")
            .insert({
              full_name: manualName.trim(),
              assigned_to: user!.id,
              office_id: newOfficeId,
              phone_number: "",
              status: "appointment_scheduled",
            })
            .select("id")
            .single();
          if (ce) throw ce;
          caseId = (cd as any).id;
        }
        const { error } = await (supabase.from as any)("appointments").insert({
          case_id: caseId,
          office_id: newOfficeId,
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
      console.error("handleSave error:", err);
      toast({ variant: "destructive", description: apptErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  /* ══ DELETE ══════════════════════════════════════════════════════════ */
  const handleDelete = async () => {
    if (!deletingAppt) return;
    setConfirmingDelete(true);
    try {
      const caseId = deletingAppt.case_id;
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", deletingAppt.id);
      if (error) throw error;

      /*
       * A case only sits at "appointment scheduled" because an appointment
       * exists. Removing the last one would otherwise strand the case in a
       * stage with nothing behind it, so it falls back to "contacted".
       */
      if (caseId) {
        const { count } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("case_id", caseId);
        if (!count) {
          await supabase
            .from("cases")
            .update({ status: "contacted" })
            .eq("id", caseId)
            .eq("status", "appointment_scheduled");
        }
      }

      toast({ title: t("team.appointments.toastDeleted") });
      setDeletingAppt(null);
      setSelectedAppt(null);
      fetchAppts();
    } catch (err: any) {
      console.error("handleDelete error:", err);
      toast({ variant: "destructive", description: t("common.error") });
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
    appts.filter(
      (a) =>
        isSameDay(zonedDay(parseISO(a.scheduled_at)), day) &&
        zonedHour(parseISO(a.scheduled_at)) === hour,
    );
  const getDay = (day: Date) =>
    appts.filter((a) => isSameDay(zonedDay(parseISO(a.scheduled_at)), day));
  // Gregorian calendar + ASCII digits in both languages
  const calLocale = isAr ? "ar-u-nu-latn-ca-gregory" : "en-US";
  // 12-hour clock label for a UTC instant, read in the office zone.
  const zonedClock = useCallback(
    (instant: Date) => {
      const { hour, minute } = activeTimezone
        ? zonedParts(instant, activeTimezone)
        : { hour: instant.getHours(), minute: instant.getMinutes() };
      return new Date(Date.UTC(2000, 0, 1, hour, minute)).toLocaleTimeString(
        calLocale,
        { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" },
      );
    },
    [activeTimezone, calLocale],
  );
  // Hour-axis label for a wall-clock hour (zone-independent; rendered in UTC).
  const hourLabel = useCallback(
    (hour: number) =>
      new Date(Date.UTC(2000, 0, 1, hour, 0)).toLocaleTimeString(calLocale, {
        hour: "numeric",
        hour12: true,
        timeZone: "UTC",
      }),
    [calLocale],
  );
  // A UTC instant as an office-local date/time carrier for date-fns `format`.
  const zonedCarrier = useCallback(
    (instant: Date) => {
      if (!activeTimezone) return instant;
      const { date, hour, minute } = zonedParts(instant, activeTimezone);
      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        hour,
        minute,
      );
    },
    [activeTimezone],
  );
  const headerLabel =
    view === "day"
      ? currentDate.toLocaleDateString(calLocale, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : view === "week"
        ? `${weekDays[0].toLocaleDateString(calLocale, { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString(calLocale, { month: "short", day: "numeric", year: "numeric" })}`
        : currentDate.toLocaleDateString(calLocale, {
            month: "long",
            year: "numeric",
          });

  /* ══ APPOINTMENT BLOCK ═══════════════════════════════════════════════
     draggable={true} always. Browser guarantees: real drag → no click fires.
     So onClick safely opens detail with zero extra logic needed.
  ═══════════════════════════════════════════════════════════════════════ */
  const ApptBlock = ({
    appt,
    compact = false,
  }: {
    appt: Appointment;
    compact?: boolean;
  }) => {
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
          "rounded-lg border select-none transition-all duration-150 overflow-hidden",
          s.bg,
          draggingId === appt.id
            ? "opacity-40 scale-95 cursor-grabbing"
            : "cursor-grab hover:shadow-xs hover:scale-[1.01] active:cursor-grabbing",
          compact
            ? "text-[9px] px-1.5 py-0.5 mb-0.5"
            : "text-[11px] p-1.5 mb-1",
        )}
      >
        <div className="flex items-center gap-1 min-w-0 w-full">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
          <span
            className="font-semibold truncate min-w-0 flex-1"
            title={
              (appt.case as any)?.full_name ??
              (appt as any)?.guest_name ??
              undefined
            }
          >
            {(appt.case as any)?.full_name ?? (appt as any)?.guest_name ?? "—"}
          </span>
        </div>
        {!compact && appt.office_id && officeNames[appt.office_id] && (
          <div className="mt-1 flex min-w-0 items-center gap-1 ps-2.5 text-[9px] font-medium opacity-75">
            <Building2 className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{officeNames[appt.office_id]}</span>
          </div>
        )}
        {!compact && (
          <div className="flex items-center gap-1 mt-0.5 opacity-65 ps-2.5 min-w-0 w-full">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              {zonedClock(parseISO(appt.scheduled_at))}
            </span>
            <span className="opacity-70 shrink-0">
              · {appt.duration_minutes}m
            </span>
          </div>
        )}
      </div>
    );
  };

  const officeLabel = (office: OfficeSummary) =>
    isAr
      ? office.name_ar
      : i18n.language.startsWith("he")
        ? office.name_he || office.name_en
        : office.name_en;

  /* ══ RENDER ══════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto sm:flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full shrink-0"
            aria-label={isAr ? "السابق" : "Previous"}
            onClick={navigatePrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            className="text-sm font-semibold min-w-0 flex-1 text-center hover:text-primary transition-colors truncate"
            onClick={() => setCurrentDate(new Date())}
          >
            {headerLabel}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full shrink-0"
            aria-label={isAr ? "التالي" : "Next"}
            onClick={navigateNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 px-3 rounded-full shrink-0"
            onClick={() => setCurrentDate(new Date())}
          >
            {t("team.appointments.navToday")}
          </Button>
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end sm:shrink-0">
          <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
            {(["day", "week", "month"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-medium rounded-full transition-all capitalize whitespace-nowrap",
                  view === v
                    ? "bg-background shadow-xs text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "day"
                  ? t("team.appointments.viewDay")
                  : v === "week"
                    ? t("team.appointments.viewWeek")
                    : t("team.appointments.viewMonth")}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            className="gap-1.5 rounded-full px-3 sm:px-4 h-8 shadow-xs shrink-0"
            onClick={() => openNew()}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {t("team.appointments.newAppointment")}
            </span>
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && visitRequests.length > 0 && (
        <section
          className="border-b border-border bg-muted/20 p-4"
          aria-label={t("team.appointments.visitRequests")}
        >
          <h2 className="mb-3 font-semibold text-foreground">
            {t("team.appointments.visitRequests")}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {visitRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between gap-3 border border-border bg-background p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {request.case?.full_name}
                  </p>
                  <p className="text-muted-foreground">
                    {format(
                      parseISO(request.scheduled_at),
                      "EEE, MMM d · h:mm a",
                    )}
                  </p>
                  {request.office_id && officeNames[request.office_id] ? (
                    <p className="text-xs font-medium text-primary">
                      {officeNames[request.office_id]}
                    </p>
                  ) : null}
                </div>
                <AppointmentActionMenu
                  appointmentId={request.id}
                  onDone={() => {
                    void fetchAppts();
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══ DAY VIEW ══ */}
      {!loading && view === "day" && (
        <div className="flex-1 overflow-auto max-w-full">
          <div className="min-w-0">
            <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-2.5">
              <div
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
                  isToday(currentDate)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {currentDate.toLocaleDateString(calLocale, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                {isToday(currentDate) && (
                  <span className="text-xs opacity-80">
                    {t("team.appointments.todayPill")}
                  </span>
                )}
              </div>
            </div>
            {HOURS.map((hour) => {
              const slotAppts = getSlot(currentDate, hour);
              const isOver =
                dragOverSlot &&
                isSameDay(dragOverSlot.day, currentDate) &&
                dragOverSlot.hour === hour;
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
                  <div className="py-2 px-3 text-xs text-muted-foreground shrink-0 flex items-start pt-2.5 border-e border-border/40 select-none">
                    {hourLabel(hour)}
                  </div>
                  <div className="min-w-0 p-1.5 cursor-pointer">
                    {isOver && (
                      <div className="text-[10px] text-violet-600 font-medium mb-1">
                        {t("team.appointments.dropSchedule")}
                      </div>
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
        <div className="flex-1 overflow-auto max-w-full">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div
              className="sticky top-0 z-10 bg-background border-b border-border grid"
              style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}
            >
              <div className="border-e border-border/40" />
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "py-2 px-1 text-center border-e border-border/40",

                    isToday(day) && "bg-violet-50/50",
                  )}
                >
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {day.toLocaleDateString(calLocale, { weekday: "short" })}
                  </div>
                  <div
                    className={cn(
                      "text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5 cursor-pointer transition-colors",
                      isToday(day)
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
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
                <div className="py-1 px-3 text-xs text-muted-foreground border-e border-border/40 flex items-start pt-2 shrink-0 select-none">
                  {hourLabel(hour)}
                </div>
                {weekDays.map((day) => {
                  const slotAppts = getSlot(day, hour);
                  const isOver =
                    dragOverSlot &&
                    isSameDay(dragOverSlot.day, day) &&
                    dragOverSlot.hour === hour;
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-w-0 border-e border-border/30 p-0.5 relative transition-colors cursor-pointer",

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
        <div className="flex min-h-0 flex-1 overflow-auto p-0">
          <div className="flex h-full min-h-0 min-w-[700px] flex-1 flex-col">
            <div className="grid shrink-0 grid-cols-7 border-b border-border bg-background">
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
                  className="flex h-9 items-center justify-center border-e border-border/30 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground last:border-e-0"
                >
                  {d}
                </div>
              ))}
            </div>

            <div
              className="grid min-h-0 flex-1"
              style={{
                gridTemplateRows: `repeat(${monthWeeks.length}, minmax(0, 1fr))`,
              }}
            >
              {monthWeeks.map((weekStart) => {
                const wDays = eachDayOfInterval({
                  start: weekStart,
                  end: endOfWeek(weekStart, { weekStartsOn: 0 }),
                });

                return (
                  <div
                    key={weekStart.toISOString()}
                    className="grid min-h-0 grid-cols-7 border-b border-border/40 last:border-b-0"
                  >
                    {wDays.map((day) => {
                      const dayAppts = getDay(day);
                      const isOver =
                        dragOverSlot && isSameDay(dragOverSlot.day, day);

                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "flex min-h-0 min-w-0 flex-col overflow-hidden border-e border-border/30 p-1.5 transition-colors last:border-e-0",
                            !isSameMonth(day, currentDate) &&
                              "bg-muted/10 text-muted-foreground opacity-35",
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
                              "mx-auto mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                              isToday(day)
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted",
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentDate(day);
                              setView("day");
                            }}
                          >
                            {format(day, "d")}
                          </div>

                          <div className="min-h-0 overflow-hidden">
                            {dayAppts.slice(0, 3).map((a) => (
                              <ApptBlock key={a.id} appt={a} compact />
                            ))}
                            {dayAppts.length > 3 && (
                              <p className="truncate text-center text-[9px] font-medium text-muted-foreground">
                                {t("team.appointments.moreCount", {
                                  count: dayAppts.length - 3,
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
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
        <DialogContent className="max-w-md" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader className="pr-12">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              </span>
              {editingAppt
                ? t("team.appointments.editTitle")
                : t("team.appointments.newTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Student */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("team.appointments.labelStudent")}
              </Label>
              {!useManualName ? (
                <div className="flex gap-2">
                  <Select value={newCaseId} onValueChange={setNewCaseId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue
                        placeholder={t("team.appointments.placeholderCase")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {myCases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-medium">{c.full_name}</span>
                          {c.phone_number && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              {c.phone_number}
                            </span>
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
                    <User className="h-3 w-3" />{" "}
                    {t("team.appointments.manualBtn")}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={isAr ? "إلغاء" : "Cancel"}
                    onClick={() => setUseManualName(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Office */}
            {myOffices.length === 1 && (
              <p className="text-xs text-muted-foreground">
                {t("team.appointments.officeLabel", "Office")}:{" "}
                <span className="font-medium text-foreground">
                  {officeLabel(myOffices[0])}
                </span>
              </p>
            )}
            {myOffices.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("team.appointments.officeLabel", "Office")}
                </Label>
                <Select
                  value={newOfficeId || "none"}
                  onValueChange={function (value) {
                    setNewOfficeId(value === "none" ? "" : value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "team.appointments.officeSelect",
                        "Select office",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("team.appointments.officeNone", "Not assigned")}
                    </SelectItem>
                    {myOffices.map((office) => (
                      <SelectItem key={office.id} value={office.id}>
                        {officeLabel(office)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date & Time */}
            <div className="grid grid-cols-2 items-start gap-3">
              <div className="min-w-0 space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("team.appointments.labelDate")}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-10 w-full justify-start rounded-full px-4 text-sm font-normal",
                        !newDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="me-2 h-4 w-4" />
                      {newDate
                        ? format(newDate, "MMM d, yyyy")
                        : t("team.appointments.placeholderDate")}
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
              <div className="min-w-0 space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("team.appointments.labelTime")}
                </Label>
                <Input
                  type="time"
                  className="h-10 w-full min-w-0 max-w-full rounded-full px-4 text-sm [appearance:none]"
                  value={newTime}
                  min={`${String(WORK_START).padStart(2, "0")}:00`}
                  max={`${String(WORK_END - 1).padStart(2, "0")}:59`}
                  onChange={(e) => setNewTime(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("team.appointments.labelTimeRange", {
                    start: `${String(WORK_START).padStart(2, "0")}:00`,
                    end: `${String(WORK_END).padStart(2, "0")}:00`,
                  })}
                </p>
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
                <FileText className="h-3 w-3" />{" "}
                {t("team.appointments.labelNotes")}
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
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              {editingAppt
                ? t("team.appointments.btnSaveChanges")
                : t("team.appointments.btnCreate")}
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
        <DialogContent className="max-w-sm" dir={isAr ? "rtl" : "ltr"}>
          {selectedAppt &&
            (() => {
              const s = apptStyle(selectedAppt.outcome);
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "w-2 h-10 rounded-full shrink-0 mt-0.5",
                          s.dot,
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <DialogTitle className="truncate">
                          {(selectedAppt.case as any)?.full_name ?? "—"}
                        </DialogTitle>
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
                      <span>
                        {format(
                          parseISO(selectedAppt.scheduled_at),
                          "EEEE, MMMM d, yyyy",
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0 text-primary/70" />
                      <span>
                        {zonedClock(parseISO(selectedAppt.scheduled_at))} ·{" "}
                        {selectedAppt.duration_minutes} min
                      </span>
                    </div>
                    {selectedAppt.notes && (
                      <div className="bg-muted/40 rounded-lg p-3 border border-border/40">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" />{" "}
                          {t("team.appointments.labelNotes")}
                        </p>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {selectedAppt.notes}
                        </p>
                      </div>
                    )}
                    <ReassignAppointment
                      appointmentId={selectedAppt.id}
                      officeId={selectedAppt.office_id}
                      currentMemberId={(selectedAppt as any).team_member_id}
                      onReassigned={() => {
                        setSelectedAppt(null);
                        fetchAppts();
                      }}
                    />
                  </div>
                  <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <div className="flex gap-2 flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => openEdit(selectedAppt)}
                      >
                        <Pencil className="h-3.5 w-3.5" />{" "}
                        {t("team.appointments.btnEdit")}
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
                        <Trash2 className="h-3.5 w-3.5" />{" "}
                        {t("team.appointments.btnDelete")}
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate(`/team/cases/${selectedAppt.case_id}`)
                      }
                    >
                      {t("team.appointments.btnViewCase")}
                    </Button>
                    {!selectedAppt.outcome &&
                      new Date(selectedAppt.scheduled_at) < new Date() && (
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
        <DialogContent className="max-w-sm" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("team.appointments.rescheduleTitle")}</DialogTitle>
          </DialogHeader>
          {pendingMove && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {t("team.appointments.rescheduleMoveText", {
                  name: (pendingMove.appt.case as any)?.full_name,
                })}
              </p>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 font-semibold text-center text-base">
                {format(
                  zonedCarrier(pendingMove.newDate),
                  "EEEE, MMMM d 'at' h:mm a",
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {t("team.appointments.rescheduleOldDate", {
                  date: format(
                    zonedCarrier(parseISO(pendingMove.appt.scheduled_at)),
                    "EEE, MMM d 'at' h:mm a",
                  ),
                })}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMove(null)}>
              {t("team.appointments.btnCancel")}
            </Button>
            <Button onClick={confirmMove} disabled={confirmingMove}>
              {confirmingMove ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
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
        <DialogContent className="max-w-sm" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("team.appointments.deleteTitle")}</DialogTitle>
          </DialogHeader>
          {deletingAppt && (
            <p className="text-sm text-muted-foreground">
              {t("team.appointments.deleteBody", {
                name: (deletingAppt.case as any)?.full_name,
                date: format(
                  parseISO(deletingAppt.scheduled_at),
                  "MMM d 'at' h:mm a",
                ),
              })}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingAppt(null)}>
              {t("team.appointments.btnCancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmingDelete}
            >
              {confirmingDelete ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
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
