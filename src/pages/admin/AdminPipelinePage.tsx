import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  RefreshCw,
  Search,
  User,
  Clock,
  AlertTriangle,
  Phone,
  MapPin,
  BookOpen,
  GraduationCap,
  Globe,
  Calculator,
  Languages,
  Briefcase,
  Pencil,
  Check,
  X,
  Trash2,
} from "lucide-react";
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
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { formatDistanceToNow } from "date-fns";

/* ─────────────────────────── constants ─────────────────────────── */

const STATUSES = [
  "new",
  "contacted",
  "appointment_scheduled",
  "profile_completion",
  "payment_confirmed",
  "submitted",
  "enrollment_paid",
];

const STATUS_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  new: { en: "New", ar: "جديد", color: "bg-blue-100 text-blue-800 border-blue-200" },
  contacted: { en: "Contacted", ar: "تم التواصل", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  appointment_scheduled: {
    en: "Appointment",
    ar: "موعد محدد",
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
  profile_completion: { en: "Profile", ar: "استكمال الملف", color: "bg-orange-100 text-orange-800 border-orange-200" },
  payment_confirmed: { en: "Payment Confirmed", ar: "تأكيد الدفع", color: "bg-teal-100 text-teal-800 border-teal-200" },
  submitted: { en: "Submitted", ar: "تم التقديم", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  enrollment_paid: { en: "Enrolled", ar: "مسجل", color: "bg-green-100 text-green-800 border-green-200" },
};

const PASSPORT_OPTIONS = [
  { value: "israeli_blue", label: "Israeli Blue Passport" },
  { value: "israeli_red", label: "Israeli Red Passport (family reunification)" },
  { value: "other", label: "Other" },
];

const EDUCATION_OPTIONS = [
  { value: "bagrut", label: "Bagrut (תעודת בגרות)" },
  { value: "bachelor", label: "Bachelor (תואר ראשון)" },
  { value: "master", label: "Master (תואר שני)" },
  { value: "other", label: "Other" },
];

const UNIT_OPTIONS = ["3", "4", "5"];

const PROFICIENCY_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

/* ─────────────────────────── types ─────────────────────────── */

interface Case {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  source: string;
  assigned_to: string | null;
  last_activity_at: string;
  created_at: string;
  is_no_show: boolean;
  assignee_name?: string;
  city: string | null;
  education_level: string | null;
  bagrut_score: number | null;
  english_level: string | null;
  english_units: number | null;
  math_units: number | null;
  passport_type: string | null;
  degree_interest: string | null;
  intake_notes: string | null;
  referred_by: string | null;
  discount_amount: number;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
}

interface EditDraft {
  city: string;
  passport_type: string;
  education_level: string;
  english_units: string;
  math_units: string;
  english_level: string;
  degree_interest: string;
  intake_notes: string;
}

/* ─────────────────────────── helpers ─────────────────────────── */

const daysSince = (ts: string) => Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);

const passportLabel = (v: string | null) =>
  PASSPORT_OPTIONS.find((o) => o.value === v)?.label ?? v?.replace(/_/g, " ") ?? "—";

const educationLabel = (v: string | null) => EDUCATION_OPTIONS.find((o) => o.value === v)?.label ?? v ?? "—";

/* ── Read-only info row ── */
function InfoRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-sm font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{String(value)}</p>
      </div>
    </div>
  );
}

/* ── Info row that always renders (shows "—" when value is null) ── */
function InfoRowAlways({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {value != null && value !== "" ? (
          <p className={`text-sm font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{String(value)}</p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">Not filled — click Edit Info to add</p>
        )}
      </div>
    </div>
  );
}

/* ── Chip selector button (edit mode) ── */
function ChipBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card border-border hover:border-primary/50 text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────── main component ─────────────────────────── */

const AdminPipelinePage = () => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const isRtl = i18n.language === "ar";

  const [cases, setCases] = useState<Case[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [assigning, setAssigning] = useState<string | null>(null);

  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ── fetch data ── */
  const fetchData = useCallback(async () => {
    try {
      const rolesRes = await supabase.from("user_roles").select("user_id").eq("role", "team_member");
      const teamIds = (rolesRes.data ?? []).map((r) => r.user_id);
      const [casesRes, profilesRes] = await Promise.all([
        supabase.from("cases").select("*").not("status", "in", '("forgotten","cancelled")'),
        teamIds.length > 0
          ? supabase.from("profiles").select("id, full_name, email").in("id", teamIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (casesRes.error) throw casesRes.error;
      const profileMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p) => {
        profileMap[p.id] = p.full_name;
      });
      const enriched = (casesRes.data || []).map((c) => ({
        ...c,
        assignee_name: c.assigned_to ? profileMap[c.assigned_to] : undefined,
      }));
      setCases(enriched);
      setTeamMembers((profilesRes.data || []).map((p) => ({ id: p.id, full_name: p.full_name, email: p.email || "" })));
      // keep sheet in sync after refresh
      setSelectedCase((prev) => (prev ? (enriched.find((c) => c.id === prev.id) ?? null) : null));
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useRealtimeSubscription("cases", fetchData, true);

  /* ── assign ── */
  const assignCase = async (caseId: string, userId: string | null) => {
    setAssigning(caseId);
    try {
      const { error } = await supabase
        .from("cases")
        .update({ assigned_to: userId || null })
        .eq("id", caseId);
      if (error) throw error;
      await fetchData();
      toast({ description: t('admin.pipeline.caseAssigned', 'Case assigned successfully') });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setAssigning(null);
    }
  };

  /* ── sheet open — fetch fresh from DB to avoid stale cache ── */
  const openCase = async (c: Case) => {
    setEditMode(false);
    setDraft(null);
    // Always fetch fresh — never trust the card's cached data
    const { data, error } = await supabase.from("cases").select("*").eq("id", c.id).single();
    if (error) {
      console.error("[openCase] fetch error:", error.message);
      setSelectedCase(c); // fallback to card data
      return;
    }
    if (data) {
      const fresh = { ...(data as any), assignee_name: c.assignee_name } as Case;
      console.log("[openCase] english_units =", fresh.english_units, "math_units =", fresh.math_units);
      setSelectedCase(fresh);
    }
  };

  /* ── start edit ── */
  const startEdit = (c: Case) => {
    setDraft({
      city: c.city ?? "",
      passport_type: c.passport_type ?? "",
      education_level: c.education_level ?? "",
      english_units: c.english_units != null ? String(c.english_units) : "",
      math_units: c.math_units != null ? String(c.math_units) : "",
      english_level: c.english_level ?? "",
      degree_interest: c.degree_interest ?? "",
      intake_notes: c.intake_notes ?? "",
    });
    setEditMode(true);
  };

  /* ── save edits to DB ── */
  const saveEdit = async () => {
    if (!selectedCase || !draft) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("cases")
        .update({
          city: draft.city.trim() || null,
          passport_type: draft.passport_type || null,
          education_level: draft.education_level || null,
          english_units: draft.english_units ? parseInt(draft.english_units) : null,
          math_units: draft.math_units ? parseInt(draft.math_units) : null,
          english_level: draft.english_level || null,
          degree_interest: draft.degree_interest.trim() || null,
          intake_notes: draft.intake_notes.trim() || null,
        })
        .eq("id", selectedCase.id);
      if (error) throw error;
      toast({ description: "Info saved successfully ✓" });
      setEditMode(false);
      setDraft(null);
      await fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  /* ── delete case ── */
  const deleteCase = async () => {
    if (!selectedCase) return;
    setDeleting(true);
    try {
      await supabase.from("documents").delete().eq("case_id", selectedCase.id);
      await supabase.from("appointments").delete().eq("case_id", selectedCase.id);
      await supabase.from("case_submissions").delete().eq("case_id", selectedCase.id);
      const { error } = await supabase.from("cases").delete().eq("id", selectedCase.id);
      if (error) throw error;
      toast({ description: "Case deleted" });
      setSelectedCase(null);
      setShowDeleteConfirm(false);
      setEditMode(false);
      await fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  /* ── duplicate phone detection ── */
  const phoneCount = cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.phone_number] = (acc[c.phone_number] ?? 0) + 1;
    return acc;
  }, {});
  const hasDuplicatePhone = (c: Case) => phoneCount[c.phone_number] > 1;

  /* ── filter ── */
  const filtered = cases.filter((c) => {
    const matchSearch =
      !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone_number.includes(search);
    const matchTeam =
      filterTeam === "all" || c.assigned_to === filterTeam || (filterTeam === "unassigned" && !c.assigned_to);
    return matchSearch && matchTeam;
  });

  const getCasesForStatus = (status: string) => filtered.filter((c) => c.status === status);
  const label = (status: string) => (isRtl ? STATUS_LABELS[status]?.ar : STATUS_LABELS[status]?.en);

  const sourceMeta: Record<string, { label: string; cls: string }> = {
    apply_page: { label: "Apply", cls: "bg-blue-100 text-blue-700" },
    contact_form: { label: "Form", cls: "bg-yellow-100 text-yellow-700" },
    manual: { label: "Manual", cls: "bg-secondary text-secondary-foreground" },
    submit_new_student: { label: "Enroll", cls: "bg-purple-100 text-purple-700" },
    referral: { label: "Referral", cls: "bg-green-100 text-green-700" },
  };

  const hasApplyInfo = (c: Case) =>
    c.city ||
    c.education_level ||
    c.passport_type ||
    c.english_units != null ||
    c.math_units != null ||
    c.english_level ||
    c.degree_interest ||
    c.intake_notes;

  const isBagrut = (draft?.education_level ?? selectedCase?.education_level) === "bagrut";

  /* ════════════════════════ render ════════════════════════ */
  return (
    <div className="p-6 space-y-4 max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("admin.pipeline.title", "Application Pipeline")}</h1>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t("common.refresh", "Refresh")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.pipeline.searchPlaceholder", "Search by name or phone...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={filterTeam} onValueChange={setFilterTeam}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by team member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {teamMembers.map((tm) => (
              <SelectItem key={tm.id} value={tm.id}>
                {tm.full_name} — {tm.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Kanban ── */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STATUSES.map((status) => {
            const statusCases = getCasesForStatus(status);
            const meta = STATUS_LABELS[status];
            return (
              <div key={status} className="w-64 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${meta.color}`}>
                    {label(status)}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">{statusCases.length}</span>
                </div>

                <div className="space-y-2">
                  {loading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                    ))
                  ) : statusCases.length === 0 ? (
                    <div className="h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">{t('admin.pipeline.emptyColumn')}</p>
                    </div>
                  ) : (
                    statusCases.map((c) => {
                      const days = daysSince(c.last_activity_at);
                      const isRedStale = (status === "new" && days >= 3) || c.is_no_show;
                      const isOrangeStale =
                        !isRedStale &&
                        ((status === "contacted" && days >= 5) ||
                          (status === "appointment_scheduled" && days >= 14) ||
                          (status === "profile_completion" && days >= 7));
                      const borderClass = isRedStale
                        ? "border-destructive/60"
                        : isOrangeStale
                          ? "border-orange-400/60"
                          : "border-border";
                      const src = sourceMeta[c.source] ?? { label: c.source, cls: "bg-muted text-muted-foreground" };

                      return (
                        <Card
                          key={c.id}
                          className={`cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-150 ${borderClass}`}
                          onClick={() => openCase(c)}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">{c.full_name}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${src.cls}`}>
                                  {src.label}
                                </span>
                                {(isRedStale || isOrangeStale) && (
                                  <AlertTriangle
                                    className={`h-3.5 w-3.5 ${isRedStale ? "text-destructive" : "text-orange-500"}`}
                                  />
                                )}
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground">{c.phone_number}</p>

                            {/* Duplicate phone warning */}
                            {hasDuplicatePhone(c) && (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 w-fit">
                                <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                <span className="text-[10px] font-semibold text-amber-700">Duplicate Phone</span>
                              </div>
                            )}

                            {/* Units badges — shown directly on card */}
                            {(c.english_units != null || c.math_units != null) && (
                              <div className="flex items-center gap-1.5">
                                {c.english_units != null && (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                                    EN {c.english_units}
                                  </span>
                                )}
                                {c.math_units != null && (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                                    MA {c.math_units}
                                  </span>
                                )}
                              </div>
                            )}

                            {c.assignee_name ? (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {c.assignee_name}
                              </p>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
                                {t('admin.pipeline.unassigned')}
                              </span>
                            )}

                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {days}d
                              </span>
                              {hasApplyInfo(c) && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                  {t('admin.pipeline.hasInfo')}
                                </span>
                              )}
                            </div>

                            {/* Assignment dropdown — stop propagation so click doesn't open sheet */}
                            <div onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={c.assigned_to || "unassigned"}
                                onValueChange={(val) => assignCase(c.id, val === "unassigned" ? null : val)}
                                disabled={assigning === c.id}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <SelectValue placeholder={t('admin.pipeline.assignPlaceholder')} />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">{t('admin.pipeline.unassigned')}</SelectItem>
                                  {teamMembers.map((tm) => (
                                    <SelectItem key={tm.id} value={tm.id}>
                                      {tm.full_name} — {tm.email}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════ Case Detail Sheet ══════════════════ */}
      <Sheet
        open={!!selectedCase}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCase(null);
            setEditMode(false);
            setDraft(null);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto" side="right">
          {selectedCase && (
            <>
              {/* ── Sheet header ── */}
              <SheetHeader className="pb-4 border-b border-border mb-5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-lg font-bold truncate">{selectedCase.full_name}</SheetTitle>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_LABELS[selectedCase.status]?.color ?? "bg-muted"}`}
                      >
                        {label(selectedCase.status)}
                      </span>
                      {selectedCase.source &&
                        (() => {
                          const s = sourceMeta[selectedCase.source] ?? {
                            label: selectedCase.source,
                            cls: "bg-muted text-muted-foreground",
                          };
                          return <span className={`text-xs px-2 py-0.5 rounded font-medium ${s.cls}`}>{s.label}</span>;
                        })()}
                    </div>
                    {/* Referral info row */}
                    {selectedCase.source === "referral" && (
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        {selectedCase.discount_amount > 0 && (
                          <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">
                            {t('admin.pipeline.discount')}: ₪{selectedCase.discount_amount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Edit / Save / Cancel */}
                  {!editMode ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0 mt-0.5"
                      onClick={() => startEdit(selectedCase)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit Info
                    </Button>
                  ) : (
                    <div className="flex gap-1.5 shrink-0 mt-0.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="px-2"
                        onClick={() => {
                          setEditMode(false);
                          setDraft(null);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" className="gap-1.5 bg-primary" onClick={saveEdit} disabled={saving}>
                        <Check className="h-3.5 w-3.5" />
                        {saving ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  )}
                </div>
              </SheetHeader>

              <div className="space-y-6">
                {/* ── CONTACT ── always read-only ── */}
                <section>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Contact</p>
                  <div className="rounded-xl border border-border bg-card px-4 divide-y divide-border">
                    <InfoRow icon={Phone} label="Phone / WhatsApp" value={selectedCase.phone_number} />
                    {!editMode && <InfoRow icon={MapPin} label="City" value={selectedCase.city} />}
                    <InfoRow
                      icon={Clock}
                      label="Submitted"
                      value={formatDistanceToNow(new Date(selectedCase.created_at), { addSuffix: true })}
                    />
                  </div>
                </section>

                {/* ══ VIEW MODE ══ */}
                {!editMode && (
                  <>
                    {selectedCase.passport_type && (
                      <section>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                          Identity
                        </p>
                        <div className="rounded-xl border border-border bg-card px-4">
                          <InfoRow
                            icon={Globe}
                            label="Passport Type"
                            value={passportLabel(selectedCase.passport_type)}
                          />
                        </div>
                      </section>
                    )}

                    {(selectedCase.education_level ||
                      (selectedCase.english_units !== null && selectedCase.english_units !== undefined) ||
                      (selectedCase.math_units !== null && selectedCase.math_units !== undefined) ||
                      selectedCase.english_level) && (
                      <section>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                          Education
                        </p>
                        <div className="rounded-xl border border-border bg-card px-4 divide-y divide-border">
                          <InfoRow
                            icon={BookOpen}
                            label="Education Level"
                            value={educationLabel(selectedCase.education_level)}
                          />
                          {/* Always show EN + MA rows for bagrut — display "—" if missing so admin knows to fill it */}
                          {selectedCase.education_level === "bagrut" ? (
                            <>
                              <InfoRowAlways
                                icon={Languages}
                                label="English Units"
                                value={
                                  selectedCase.english_units !== null && selectedCase.english_units !== undefined
                                    ? `${selectedCase.english_units} units`
                                    : null
                                }
                                highlight
                              />
                              <InfoRowAlways
                                icon={Calculator}
                                label="Math Units"
                                value={
                                  selectedCase.math_units !== null && selectedCase.math_units !== undefined
                                    ? `${selectedCase.math_units} units`
                                    : null
                                }
                                highlight
                              />
                            </>
                          ) : (
                            <>
                              <InfoRowAlways
                                icon={Languages}
                                label="English Units"
                                value={
                                  selectedCase.english_units !== null && selectedCase.english_units !== undefined
                                    ? `${selectedCase.english_units} units`
                                    : null
                                }
                                highlight
                              />
                              <InfoRow
                                icon={Calculator}
                                label="Math Units"
                                value={selectedCase.math_units != null ? `${selectedCase.math_units} units` : null}
                                highlight
                              />
                            </>
                          )}
                          <InfoRow icon={Languages} label="English Proficiency" value={selectedCase.english_level} />
                        </div>
                      </section>
                    )}

                    {selectedCase.degree_interest && (
                      <section>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                          Preferences
                        </p>
                        <div className="rounded-xl border border-border bg-card px-4">
                          <InfoRow
                            icon={Briefcase}
                            label="Preferred Major / Degree"
                            value={selectedCase.degree_interest}
                          />
                        </div>
                      </section>
                    )}

                    {selectedCase.intake_notes && (
                      <section>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                          Notes
                        </p>
                        <div className="rounded-xl border border-border bg-card p-4">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedCase.intake_notes}</p>
                        </div>
                      </section>
                    )}

                    {!hasApplyInfo(selectedCase) && (
                      <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
                        <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">No application info yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          Click <strong>Edit Info</strong> above to fill in details manually.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* ══ EDIT MODE ══ */}
                {editMode && draft && (
                  <section className="space-y-5">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Edit Application Info
                    </p>

                    {/* City */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> City
                      </label>
                      <Input
                        value={draft.city}
                        onChange={(e) => setDraft((d) => d && { ...d, city: e.target.value })}
                        placeholder="e.g. Haifa"
                        className="h-10"
                      />
                    </div>

                    {/* Passport Type */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" /> Passport Type
                      </label>
                      <div className="flex flex-col gap-2">
                        {PASSPORT_OPTIONS.map((o) => (
                          <ChipBtn
                            key={o.value}
                            active={draft.passport_type === o.value}
                            onClick={() => setDraft((d) => d && { ...d, passport_type: o.value })}
                          >
                            {o.label}
                          </ChipBtn>
                        ))}
                      </div>
                    </div>

                    {/* Education Level */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" /> Education Level
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {EDUCATION_OPTIONS.map((o) => (
                          <ChipBtn
                            key={o.value}
                            active={draft.education_level === o.value}
                            onClick={() =>
                              setDraft(
                                (d) =>
                                  d && {
                                    ...d,
                                    education_level: o.value,
                                    english_level: "",
                                  },
                              )
                            }
                          >
                            {o.label}
                          </ChipBtn>
                        ))}
                      </div>
                    </div>

                    {/* Bagrut: English + Math units */}
                    {isBagrut && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                            <Languages className="h-3.5 w-3.5" /> English Units
                          </label>
                          <div className="flex gap-2">
                            {UNIT_OPTIONS.map((u) => (
                              <ChipBtn
                                key={u}
                                active={draft.english_units === u}
                                onClick={() => setDraft((d) => d && { ...d, english_units: u })}
                              >
                                {u}
                              </ChipBtn>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                            <Calculator className="h-3.5 w-3.5" /> Math Units
                          </label>
                          <div className="flex gap-2">
                            {UNIT_OPTIONS.map((u) => (
                              <ChipBtn
                                key={u}
                                active={draft.math_units === u}
                                onClick={() => setDraft((d) => d && { ...d, math_units: u })}
                              >
                                {u}
                              </ChipBtn>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Higher-ed: English proficiency */}
                    {(draft.education_level === "bachelor" || draft.education_level === "master") && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                          <Languages className="h-3.5 w-3.5" /> English Proficiency
                        </label>
                        <div className="flex gap-2">
                          {PROFICIENCY_OPTIONS.map((o) => (
                            <ChipBtn
                              key={o.value}
                              active={draft.english_level === o.value}
                              onClick={() => setDraft((d) => d && { ...d, english_level: o.value })}
                            >
                              {o.label}
                            </ChipBtn>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preferred Major */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" /> Preferred Major / Degree
                      </label>
                      <Input
                        value={draft.degree_interest}
                        onChange={(e) => setDraft((d) => d && { ...d, degree_interest: e.target.value })}
                        placeholder="e.g. Engineering, Medicine..."
                        className="h-10"
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground/80">Intake Notes</label>
                      <textarea
                        value={draft.intake_notes}
                        onChange={(e) => setDraft((d) => d && { ...d, intake_notes: e.target.value })}
                        placeholder="Any notes about this student..."
                        rows={3}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>

                    <Button className="w-full h-10 gap-2" onClick={saveEdit} disabled={saving}>
                      <Check className="h-4 w-4" />
                      {saving ? "Saving…" : "Save Changes"}
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full h-10 gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleting}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete This Case
                    </Button>
                  </section>
                )}

                <Separator />

                {/* ── Assign team member ── */}
                <section>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Assign to Team Member
                  </p>

                  {selectedCase.assignee_name && (
                    <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Currently assigned to</p>
                        <p className="text-sm font-bold">{selectedCase.assignee_name}</p>
                      </div>
                    </div>
                  )}

                  <div onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={selectedCase.assigned_to || "unassigned"}
                      onValueChange={(val) => assignCase(selectedCase.id, val === "unassigned" ? null : val)}
                      disabled={assigning === selectedCase.id}
                    >
                      <SelectTrigger className="w-full h-10">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <SelectValue placeholder="Assign to team member" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">Unassigned</span>
                        </SelectItem>
                        {teamMembers.map((tm) => (
                          <SelectItem key={tm.id} value={tm.id}>
                            <div className="flex flex-col py-0.5">
                              <span className="font-medium">{tm.full_name}</span>
                              <span className="text-xs text-muted-foreground">{tm.email}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {assigning === selectedCase.id && (
                    <p className="text-xs text-muted-foreground mt-2 text-center animate-pulse">Assigning…</p>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Case
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the case for <strong>{selectedCase?.full_name}</strong>? This
              will also delete all appointments, submissions, and documents. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteCase}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Yes, Delete Case"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPipelinePage;
