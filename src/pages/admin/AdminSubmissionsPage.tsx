import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, ChevronRight, Download, FileText, User, Lock, ExternalLink, SplitSquareHorizontal, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { CopyButton } from "@/components/common/CopyButton";

interface SubmittedCase {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  created_at: string;
  education_level: string | null;
  city: string | null;
  passport_type: string | null;
  student_user_id: string | null;
  partner_id: string | null;
  assigned_to: string | null;
  submission?: {
    id: string;
    service_fee: number;
    submitted_at: string | null;
    enrollment_paid_at: string | null;
    program_id: string | null;
    accommodation_id: string | null;
    program_start_date: string | null;
    program_end_date: string | null;
    payment_confirmed: boolean;
    extra_data: Record<string, unknown> | null;
  } | null;
  documents?: Array<{ id: string; file_name: string; file_url: string; category: string; created_at: string }>;
}

interface CommissionPreview {
  serviceFee: number;
  partners: { partnerId: string; name: string; amount: number }[];
  teamCommission: number;
  platformRevenue: number;
  // legacy single field for the log message
  partnerCommission: number;
}

const AdminSubmissionsPage = () => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = i18n.language === "ar";

  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [cases, setCases] = useState<SubmittedCase[]>([]);
  const [completedCases, setCompletedCases] = useState<SubmittedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SubmittedCase | null>(null);
  const [marking, setMarking] = useState(false);

  const [programNames, setProgramNames] = useState<Record<string, string>>({});
  const [accommodationNames, setAccommodationNames] = useState<Record<string, string>>();

  // Split panel state
  const [showSplitPanel, setShowSplitPanel] = useState(false);
  const [splitPreview, setSplitPreview] = useState<CommissionPreview>({ serviceFee: 0, partnerCommission: 0, teamCommission: 0, platformRevenue: 0 });

  // Password gate state
  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState("");
  const [reAuthing, setReAuthing] = useState(false);

  const enrichCases = useCallback(async (ids: string[], rawCases: any[]) => {
    if (ids.length === 0) return [];
    const [subRes, docsRes] = await Promise.all([
      supabase.from("case_submissions").select("*").in("case_id", ids),
      supabase.from("documents").select("id, file_name, file_url, category, created_at, case_id").in("case_id", ids),
    ]);
    const subMap: Record<string, any> = {};
    (subRes.data || []).forEach((s) => { subMap[s.case_id] = s; });
    const docsMap: Record<string, any[]> = {};
    (docsRes.data || []).forEach((d) => {
      if (!docsMap[d.case_id]) docsMap[d.case_id] = [];
      docsMap[d.case_id].push(d);
    });
    return rawCases.map((c) => ({
      ...c,
      submission: subMap[c.id] || null,
      documents: docsMap[c.id] || [],
    }));
  }, []);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, completedRes] = await Promise.all([
        supabase
          .from("cases")
          .select("id, full_name, phone_number, status, created_at, education_level, city, passport_type, student_user_id, partner_id, assigned_to")
          .in("status", ["submitted", "payment_confirmed"])
          .order("created_at", { ascending: false }),
        supabase
          .from("cases")
          .select("id, full_name, phone_number, status, created_at, education_level, city, passport_type, student_user_id, partner_id, assigned_to")
          .eq("status", "enrollment_paid")
          .order("created_at", { ascending: false }),
      ]);

      if (pendingRes.error) throw pendingRes.error;
      if (completedRes.error) throw completedRes.error;

      const pendingIds = (pendingRes.data || []).map((c) => c.id);
      const completedIds = (completedRes.data || []).map((c) => c.id);

      const [enrichedPending, enrichedCompleted] = await Promise.all([
        enrichCases(pendingIds, pendingRes.data || []),
        enrichCases(completedIds, completedRes.data || []),
      ]);

      setCases(enrichedPending);
      setCompletedCases(enrichedCompleted);

      const allEnriched = [...enrichedPending, ...enrichedCompleted];
      const programIds = [...new Set(allEnriched.map((c) => c.submission?.program_id).filter(Boolean) as string[])];
      const accommodationIds = [...new Set(allEnriched.map((c) => c.submission?.accommodation_id).filter(Boolean) as string[])];

      if (programIds.length > 0) {
        const { data: progData } = await (supabase as any).from("programs").select("id, name_en").in("id", programIds);
        const map: Record<string, string> = {};
        (progData || []).forEach((p: any) => { map[p.id] = p.name_en; });
        setProgramNames(map);
      }

      if (accommodationIds.length > 0) {
        const { data: accomData } = await (supabase as any).from("accommodations").select("id, name_en").in("id", accommodationIds);
        const map: Record<string, string> = {};
        (accomData || []).forEach((a: any) => { map[a.id] = a.name_en; });
        setAccommodationNames(map);
      }
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast, enrichCases]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  // Load commission preview for selected case.
  // Partner commission is ONLY shown when the case has an explicit partner_id set.
  // Cases with partner_id = null show ₪0 partner commission — no auto-attribution here.
  const loadSplitPreview = useCallback(async (c: SubmittedCase) => {
    const fee = c.submission?.service_fee || 0;
    try {
      const [settRes, partnerOvRes, teamOvRes] = await Promise.all([
        (supabase as any).from("platform_settings").select("partner_commission_rate, team_member_commission_rate").limit(1).single(),
        // Only fetch partner override if case has an explicit partner_id — never auto-assign
        c.partner_id
          ? (supabase as any).from("partner_commission_overrides").select("commission_amount").eq("partner_id", c.partner_id).maybeSingle()
          : Promise.resolve({ data: null }),
        c.assigned_to ? (supabase as any).from("team_member_commission_overrides").select("commission_amount").eq("team_member_id", c.assigned_to).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const globalTeam = (settRes.data as any)?.team_member_commission_rate ?? 100;
      // Partner commission is 0 when no partner_id is set on the case
      const partnerCommission = c.partner_id
        ? (partnerOvRes.data?.commission_amount ?? ((settRes.data as any)?.partner_commission_rate ?? 500))
        : 0;
      const teamCommission = teamOvRes.data?.commission_amount ?? (c.assigned_to ? globalTeam : 0);
      setSplitPreview({
        serviceFee: fee,
        partnerCommission,
        teamCommission,
        platformRevenue: Math.max(0, fee - partnerCommission - teamCommission),
      });
    } catch {
      setSplitPreview({ serviceFee: fee, partnerCommission: 0, teamCommission: 0, platformRevenue: fee });
    }
  }, []);

  const openSplitPanel = async () => {
    if (!selected) return;
    await loadSplitPreview(selected);
    setShowSplitPanel(true);
  };

  const handleReAuth = async () => {
    if (!reAuthPassword.trim() || !user?.email) return;
    setReAuthing(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: reAuthPassword });
      if (error) throw error;
      setShowPasswordGate(false);
      setReAuthPassword("");
      await markEnrolled();
    } catch (err: any) {
      toast({ variant: "destructive", description: t("admin.submissions.incorrectPassword") });
    } finally {
      setReAuthing(false);
    }
  };

  const markEnrolled = async () => {
    if (!selected) return;
    setMarking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // No auto-attribution: partner commission only fires for cases where partner_id is
      // explicitly set. Cases without a partner_id get ₪0 partner commission — this is correct
      // and prevents assigning the wrong partner when multiple partners exist.

      // Call admin-mark-paid edge function to trigger record_case_commission automatically
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ case_id: selected.id, total_payment_ils: splitPreview.serviceFee }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed");

      await supabase.rpc("log_user_activity" as any, {
        p_action: "MARK_ENROLLED",
        p_target_id: selected.id,
        p_target_table: "cases",
        p_details: `Marked case ${selected.full_name} as enrolled. Split: partner=${splitPreview.partnerCommission}, team=${splitPreview.teamCommission}`,
      });

      toast({ description: t("admin.submissions.enrolledSuccess") });
      setSelected(null);
      setShowSplitPanel(false);
      setSplitPreview({ serviceFee: 0, partnerCommission: 0, teamCommission: 0, platformRevenue: 0 });
      await fetchCases();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setMarking(false);
    }
  };

  const fmt = (ts: string | null) => {
    if (!ts) return "–";
    return format(new Date(ts), "dd/MM/yyyy");
  };

  const totalFee = (s: SubmittedCase) =>
    (s.submission?.service_fee || 0).toLocaleString('en-US');

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("admin.submissions.title", "Submitted Applications")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin.submissions.subtitle", "Cases awaiting enrollment confirmation")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCases}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Subtabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border border-b-0 transition-colors ${
            activeTab === "pending"
              ? "bg-background text-foreground border-border"
              : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
        >
          {t("admin.submissions.tabPending", "Pending Review")}
          <span className={`ms-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === "pending" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {cases.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border border-b-0 transition-colors ${
            activeTab === "completed"
              ? "bg-background text-foreground border-border"
              : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
        >
          {t("admin.submissions.tabCompleted", "Completed")}
          <span className={`ms-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === "completed" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
            {completedCases.length}
          </span>
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {t("common.loading")}
            </div>
          ) : activeTab === "pending" ? (
            cases.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {t("admin.submissions.empty", "No submitted cases yet")}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelected(c)}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.phone_number} · {t("admin.submissions.submittedDate")}:{" "}
                        {fmt(c.submission?.submitted_at || null)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-end">
                        <p className="text-sm font-semibold text-foreground">{totalFee(c)} ILS</p>
                        <p className="text-xs text-muted-foreground">{t("admin.submissions.totalFees")}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            completedCases.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {t("admin.submissions.emptyCompleted", "No completed cases yet")}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {completedCases.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelected(c)}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.phone_number} · {t("admin.submissions.enrolledOn")}:{" "}
                        {fmt(c.submission?.enrollment_paid_at || null)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 border hidden sm:flex">
                        <CheckCircle2 className="h-3 w-3" />
                        {t("admin.submissions.tabCompleted")}
                      </Badge>
                      <div className="text-end">
                        <p className="text-sm font-semibold text-foreground">{totalFee(c)} ILS</p>
                        <p className="text-xs text-muted-foreground">{t("admin.submissions.totalFees")}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Full Case Detail Dialog */}
      <Dialog open={!!selected && !showSplitPanel && !showPasswordGate} onOpenChange={() => setSelected(null)}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> {selected?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  {t("admin.submissions.basicInfo")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.phone")}:</span>
                    <div className="flex items-center gap-1">
                      <p className="font-medium">{selected.phone_number}</p>
                      <CopyButton value={selected.phone_number} />
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.city")}:</span>
                    <div className="flex items-center gap-1">
                      <p className="font-medium">{selected.city || "–"}</p>
                      {selected.city && <CopyButton value={selected.city} />}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.education")}:</span>
                    <div className="flex items-center gap-1">
                      <p className="font-medium">{selected.education_level || "–"}</p>
                      {selected.education_level && <CopyButton value={selected.education_level} />}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.passport")}:</span>
                    <div className="flex items-center gap-1">
                      <p className="font-medium">{selected.passport_type?.replace(/_/g, " ") || "–"}</p>
                      {selected.passport_type && <CopyButton value={selected.passport_type.replace(/_/g, " ")} />}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.submittedDate")}:</span>
                    <div className="flex items-center gap-1">
                      <p className="font-medium">{fmt(selected.submission?.submitted_at || null)}</p>
                      {selected.submission?.submitted_at && <CopyButton value={fmt(selected.submission.submitted_at)} />}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.payment")}:</span>
                    <Badge
                      className={
                        selected.submission?.payment_confirmed
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {selected.submission?.payment_confirmed
                        ? t("admin.submissions.paymentConfirmed")
                        : t("admin.submissions.paymentPending")}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Payment Details */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  {t("admin.submissions.paymentDetails")}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.serviceFee")}:</span>
                    <div className="flex items-center gap-1">
                      <p className="font-medium">{(selected.submission?.service_fee || 0).toLocaleString('en-US')} ILS</p>
                      <CopyButton value={String(selected.submission?.service_fee || 0)} />
                    </div>
                  </div>
                  {selected.submission?.program_start_date && (
                    <div>
                      <span className="text-muted-foreground">{t("admin.submissions.startDate")}:</span>
                      <div className="flex items-center gap-1">
                        <p className="font-medium">{fmt(selected.submission.program_start_date)}</p>
                        <CopyButton value={fmt(selected.submission.program_start_date)} />
                      </div>
                    </div>
                  )}
                  {selected.submission?.program_end_date && (
                    <div>
                      <span className="text-muted-foreground">{t("admin.submissions.endDate")}:</span>
                      <div className="flex items-center gap-1">
                        <p className="font-medium">{fmt(selected.submission.program_end_date)}</p>
                        <CopyButton value={fmt(selected.submission.program_end_date)} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 p-3 rounded-lg bg-muted text-sm">
                  <span className="text-muted-foreground">{t("admin.submissions.total")}:</span>
                  <span className="font-bold ms-2 text-foreground">{totalFee(selected)} ILS</span>
                </div>
              </div>

              {/* Program / Accommodation resolved names */}
              {(selected.submission?.program_id || selected.submission?.accommodation_id) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      {t("admin.submissions.programAccom")}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {selected.submission?.program_id && (
                        <div>
                          <span className="text-muted-foreground">{t("admin.submissions.program")}:</span>
                          <p className="font-medium">
                            {programNames[selected.submission.program_id] || selected.submission.program_id}
                          </p>
                        </div>
                      )}
                      {selected.submission?.accommodation_id && (
                        <div>
                          <span className="text-muted-foreground">{t("admin.submissions.accommodation")}:</span>
                          <p className="font-medium">
                            {accommodationNames?.[selected.submission.accommodation_id] || selected.submission.accommodation_id}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Extra Profile Data */}
              {selected.submission?.extra_data && Object.keys(selected.submission.extra_data).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      {t("admin.submissions.studentProfileData")}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {Object.entries(selected.submission.extra_data).map(([key, val]) => {
                        if (!val || val === "") return null;
                        if (key === "program_id" || key === "accommodation_id") return null;
                        const fieldLabel = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                        return (
                          <div key={key}>
                            <span className="text-muted-foreground">{fieldLabel}:</span>
                            <div className="flex items-center gap-1">
                              <p className="font-medium">{String(val)}</p>
                              <CopyButton value={String(val)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Documents */}
              {selected.documents && selected.documents.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" /> {t("admin.submissions.documents")} ({selected.documents.length})
                    </h3>
                    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {selected.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.category} · {fmt(doc.created_at)}
                            </p>
                          </div>
                          <a href={doc.file_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Enrolled badge for completed cases */}
              {selected.status === "enrollment_paid" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-800">{t("admin.submissions.tabCompleted")}</p>
                    {selected.submission?.enrollment_paid_at && (
                      <p className="text-emerald-700 text-xs">
                        {t("admin.submissions.enrolledOn")}: {fmt(selected.submission.enrollment_paid_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    const caseId = selected.id;
                    setSelected(null);
                    navigate(`/admin/pipeline?case=${caseId}`);
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("admin.submissions.openFullCase")}
                </Button>
                {selected.status !== "enrollment_paid" && (
                  <Button className="w-full gap-2" onClick={openSplitPanel} disabled={marking}>
                    <SplitSquareHorizontal className="h-4 w-4" />
                    {t("admin.submissions.markEnrolled", "Mark as Enrolled")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Split Panel */}
      <Dialog open={showSplitPanel} onOpenChange={(v) => { if (!v) setShowSplitPanel(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SplitSquareHorizontal className="h-5 w-5 text-primary" />
              {t("admin.submissions.paymentSplit", "Payment Split")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("admin.submissions.paymentSplitDesc", "Review how the service fee will be split before confirming enrollment.")}
            </p>
            <div className="space-y-2">
              <div className="flex justify-between p-3 rounded-lg bg-muted border border-border text-sm">
                <span className="text-muted-foreground">{t("admin.submissions.serviceFee")}</span>
                <span className="font-bold text-foreground">₪{splitPreview.serviceFee.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg border border-border text-sm">
                <span className="text-muted-foreground">{t("admin.commission.partner", "Partner Commission")}</span>
                <span className="font-semibold text-orange-600">-₪{splitPreview.partnerCommission.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg border border-border text-sm">
                <span className="text-muted-foreground">{t("admin.commission.teamMember", "Team Commission")}</span>
                <span className="font-semibold text-purple-600">-₪{splitPreview.teamCommission.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
                <span className="font-semibold">{t("admin.commission.platformRevenue", "Platform Revenue")}</span>
                <span className="font-bold text-emerald-700">₪{splitPreview.platformRevenue.toLocaleString('en-US')}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("admin.submissions.splitNote", "Commissions are set in Settings → Money Split. Confirm with your password to proceed.")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSplitPanel(false)}>
              {t("admin.submissions.cancel")}
            </Button>
            <Button onClick={() => { setShowSplitPanel(false); setShowPasswordGate(true); }} disabled={marking}>
              <Lock className="h-4 w-4 me-1" />
              {t("admin.submissions.confirmEnroll", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Re-Auth Gate */}
      <Dialog
        open={showPasswordGate}
        onOpenChange={(v) => {
          setShowPasswordGate(v);
          setReAuthPassword("");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              {t("admin.submissions.confirmIdentity")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("admin.submissions.confirmIdentityDesc")}
            </p>
            <div>
              <Label>{t("admin.submissions.password")}</Label>
              <Input
                type="password"
                value={reAuthPassword}
                onChange={(e) => setReAuthPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReAuth()}
                className="mt-1"
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordGate(false);
                setReAuthPassword("");
              }}
            >
              {t("admin.submissions.cancel")}
            </Button>
            <Button onClick={handleReAuth} disabled={reAuthing || !reAuthPassword.trim()}>
              {reAuthing ? "..." : t("admin.submissions.confirmEnroll")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSubmissionsPage;
