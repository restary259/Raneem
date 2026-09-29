import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RefreshCw,
  ChevronRight,
  User,
  Lock,
  ExternalLink,
  SplitSquareHorizontal,
  CheckCircle2,
  Landmark,
  Banknote,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toneClasses } from "@/lib/statusTokens";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useNavigate } from "@/lib/router-compat";
import { CopyButton } from "@/components/common/CopyButton";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/common/TablePagination";
import SubmissionCaseTabs, { type SubmittedCase } from "@/components/admin/SubmissionCaseTabs";
import { type CaseFinanceReadiness } from "@/components/cases/CaseFinance";
import { useCaseFinancials } from "@/hooks/useCaseFinancials";
import { identityConflictMessage } from "@/lib/identityConflict";
import { checkEmailAvailability } from "@/lib/checkEmailAvailability";
import { sendCaseMessage } from "@/services/CaseMessageService";


/** Referrer roles the server preview can return, mirroring record_case_commission. */
type ReferrerRole = "partner" | "ambassador" | "agent_self" | "student";

interface CommissionPreview {
  serviceFee: number;
  referralDiscount: number;
  /** The single account that earns the referral commission for this case (if any). */
  referrer: { userId: string; name: string; role: ReferrerRole; amount: number; customRate: boolean } | null;
  teamCommission: number;
  /** Whether the team amount came from a per-member override rather than the global rate. */
  teamCustomRate: boolean;
  teamName: string | null;
  /** Recruiting agent paid on top of the partner pool (additive). */
  agent: { name: string; amount: number } | null;
  platformRevenue: number;
  marginWarning: boolean;
  // legacy single field for the log message
  partnerCommission: number;
}

const EMPTY_SPLIT: CommissionPreview = {
  serviceFee: 0,
  referralDiscount: 0,
  referrer: null,
  teamCommission: 0,
  teamCustomRate: false,
  teamName: null,
  agent: null,
  platformRevenue: 0,
  marginWarning: false,
  partnerCommission: 0,
};



const AdminSubmissionsPage = () => {
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = i18n.language === "ar";

  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [cases, setCases] = useState<SubmittedCase[]>([]);
  const [completedCases, setCompletedCases] = useState<SubmittedCase[]>([]);
  const pendingPagination = usePagination(cases, 25);
  const completedPagination = usePagination(completedCases, 25);

  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SubmittedCase | null>(null);
  const [marking, setMarking] = useState(false);

  const [programNames, setProgramNames] = useState<Record<string, string>>({});
  const [accommodationNames, setAccommodationNames] = useState<Record<string, string>>({});
  const [financialsMap, setFinancialsMap] = useState<Record<string, { service_total: number }>>({});
  /** payment_method per case, keyed by case_id (from confirmed agency_service payment). */
  const [paymentMethodMap, setPaymentMethodMap] = useState<Record<string, string>>({});

  // Split panel state
  const [showSplitPanel, setShowSplitPanel] = useState(false);
  const [splitPreview, setSplitPreview] = useState<CommissionPreview>(EMPTY_SPLIT);
  const [financeReadiness, setFinanceReadiness] = useState<CaseFinanceReadiness | null>(null);


  // Password gate state
  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState("");
  const [reAuthing, setReAuthing] = useState(false);

  // Student account email captured during enrollment confirmation
  const [approveEmail, setApproveEmail] = useState("");

  // Whether a pending student invitation already exists for the selected case
  // (the team already sent the activation link at submission time). When true,
  // the enroll panel must NOT re-ask for the student's email or re-send an
  // invite — it only needs the admin password confirmation.
  const [hasPendingInvitation, setHasPendingInvitation] = useState(false);

  // "Return for changes" dialog state.
  const [returnCaseId, setReturnCaseId] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [returning, setReturning] = useState(false);

  const enrichCases = useCallback(async (ids: string[], rawCases: any[]) => {
    if (ids.length === 0) return [];
    const [subRes, docsRes] = await Promise.all([
      supabase.from("case_submissions").select("*").in("case_id", ids).is("deleted_at", null),
      supabase.from("documents").select("id, file_name, file_url, category, created_at, case_id").in("case_id", ids),
    ]);
    const subMap: Record<string, any> = {};
    (subRes.data || []).forEach((s) => {
      subMap[s.case_id] = s;
    });
    const docsMap: Record<string, any[]> = {};
    (docsRes.data || []).forEach((d) => {
      if (!d.case_id) return;
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
          .select(
            "id, full_name, phone_number, status, source, created_at, education_level, city, passport_type, student_user_id, partner_id, referred_by, assigned_to",
          )
          .eq("status", "submitted")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("cases")
          .select(
            "id, full_name, phone_number, status, created_at, education_level, city, passport_type, student_user_id, partner_id, referred_by, assigned_to",
          )
          .eq("status", "enrollment_paid")
          .is("deleted_at", null)
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
      const accommodationIds = [
        ...new Set(allEnriched.map((c) => c.submission?.accommodation_id).filter(Boolean) as string[]),
      ];
      const allCaseIds = allEnriched.map((c) => c.id);

      // Fetch financials for all cases to get authoritative service_total
      if (allCaseIds.length > 0) {
        const financialsPromises = allCaseIds.map(async (caseId) => {
          const { data } = await (supabase as any).rpc("get_case_financials", { p_case_id: caseId });
          return { caseId, service_total: Number(data?.service_total ?? 0) };
        });
        const financialsResults = await Promise.all(financialsPromises);
        const finMap: Record<string, { service_total: number }> = {};
        financialsResults.forEach(({ caseId, service_total }) => {
          finMap[caseId] = { service_total };
        });
        setFinancialsMap(finMap);

        // Fetch payment_method from confirmed agency_service payments
        const { data: pmData } = await (supabase as any)
          .from("case_payments")
          .select("case_id, payment_method")
          .in("case_id", allCaseIds)
          .eq("payment_type", "agency_service")
          .eq("status", "confirmed");
        const pmMap: Record<string, string> = {};
        (pmData || []).forEach((p: any) => {
          if (p.payment_method) pmMap[p.case_id] = p.payment_method;
        });
        setPaymentMethodMap(pmMap);
      }

      if (programIds.length > 0) {
        const { data: progData } = await (supabase as any)
          .from("programs")
          .select("id, name_en, name_ar")
          .in("id", programIds);
        const map: Record<string, string> = {};
        (progData || []).forEach((p: any) => {
          map[p.id] = (isAr ? p.name_ar || p.name_en : p.name_en || p.name_ar) ?? "";
        });
        setProgramNames(map);
      }

      if (accommodationIds.length > 0) {
        const { data: accomData } = await (supabase as any)
          .from("accommodations")
          .select("id, name_en, name_ar")
          .in("id", accommodationIds);
        const map: Record<string, string> = {};
        (accomData || []).forEach((a: any) => {
          map[a.id] = (isAr ? a.name_ar || a.name_en : a.name_en || a.name_ar) ?? "";
        });
        setAccommodationNames(map);
      }
    } catch (err: any) {
      console.error("[AdminSubmissions]", err);
      toast({ variant: "destructive", title: t("common.error"), description: t("common.actionFailed") });
    } finally {
      setLoading(false);
    }
  }, [toast, enrichCases, isAr, t]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  /** Human label for the account that earns the referral commission. */
  const referrerRoleLabel = useCallback(
    (role: ReferrerRole): string => {
      if (role === "ambassador") return t("admin.commission.ambassador", "Ambassador");
      if (role === "agent_self") return t("admin.commission.agentSelf", "Agent (own referral)");
      if (role === "student") return t("admin.commission.studentReferrer", "Student referrer");
      return t("admin.commission.partner", "Partner");
    },
    [t],
  );


  /**
   * Commission preview.
   *
   * The whole split is resolved server-side by `preview_case_commission_split`,
   * which runs the SAME classification and the SAME rate resolvers as
   * `record_case_commission` (partner pool / ambassador rate / agent
   * recruitment share / agent self-referral / student referral reward). The
   * browser never re-derives commission math, so the preview cannot disagree
   * with what is actually paid at enrollment.
   */
  const loadSplitPreview = useCallback(async (c: SubmittedCase) => {
    try {
      const { data, error } = await (supabase as any).rpc("preview_case_commission_split", {
        p_case_id: c.id,
      });
      if (error) throw error;

      const referrer = data?.referrer
        ? {
            userId: String(data.referrer.user_id),
            name: String(data.referrer.name ?? ""),
            role: (data.referrer.role ?? "partner") as ReferrerRole,
            amount: Number(data.referrer.amount ?? 0),
            customRate: Boolean(data.referrer.custom_rate),
          }
        : null;

      setSplitPreview({
        serviceFee: Number(data?.service_total ?? 0),
        referralDiscount: Number(data?.referral_discount ?? 0),
        referrer,
        teamCommission: Number(data?.team?.amount ?? 0),
        teamCustomRate: Boolean(data?.team?.custom_rate),
        teamName: data?.team?.name ?? null,
        agent: data?.agent
          ? { name: String(data.agent.name ?? ""), amount: Number(data.agent.amount ?? 0) }
          : null,
        platformRevenue: Number(data?.platform_revenue ?? 0),
        marginWarning: Boolean(data?.margin_warning),
        partnerCommission: referrer?.amount ?? 0,
      });
    } catch (err) {
      console.error("[AdminSubmissions] split preview failed", err);
      setSplitPreview(EMPTY_SPLIT);
    }
  }, []);



  /** Return the selected case to the team member with a change-request note.
   *  request_case_changes sets review_status='changes_requested' and moves the
   *  case back to profile_completion so the team can fix & resubmit. The note
   *  is also posted to the case chat (internal) so it lands in the thread the
   *  team already watches — best-effort, never undoes a completed return. */
  const handleReturnCase = async () => {
    if (!returnCaseId || !returnNote.trim()) return;
    const note = returnNote.trim();
    setReturning(true);
    try {
      const { error } = await supabase.rpc("request_case_changes", {
        p_case_id: returnCaseId,
        p_note: note,
      });
      if (error) throw error;
      // Mirror the note into the case chat thread. Non-blocking: a chat hiccup
      // must not roll back an already-completed return (the banner + Work page
      // still show the note from review_note). The server stamps the admin as
      // author and 'internal' visibility keeps it staff-visible only.
      try {
        await sendCaseMessage(
          returnCaseId,
          `${t("admin.submissions.returnChatPrefix", "Admin returned this case for changes:")}\n\n${note}`,
          "internal",
        );
      } catch (err) {
        // Best-effort: a chat hiccup must not roll back the completed return.
        console.warn("postReturnChatNote failed", err);
      }
      toast({ description: t("admin.submissions.returnedSuccess", "Case returned to team for changes") });
      setSelected(null);
      setReturnCaseId(null);
      setReturnNote("");
      await fetchCases();
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("common.actionFailed") });
    } finally {
      setReturning(false);
    }
  };

  const openSplitPanel = async () => {
    if (!selected) return;
    if (
      !financeReadiness ||
      financeReadiness.germanyConfirmedRequired < financeReadiness.germanyRequiredTotal
    ) {
      toast({
        variant: "destructive",
        description: t(
          "admin.submissions.confirmGermanPaymentsFirst",
          "Confirm the language course and accommodation payments before marking this case as enrolled.",
        ),
      });
      return;
    }
    setApproveEmail("");
    // Check whether the team already sent the student an activation link (a
    // pending user_invitations row for this case). create-student-from-case in
    // invite mode no longer pre-creates the auth account, so student_user_id
    // stays NULL until the student activates — that NULL alone is NOT a signal
    // to re-invite.
    setHasPendingInvitation(false);
    try {
      const { data: pending } = await (supabase as any)
        .from("user_invitations")
        .select("id")
        .eq("case_id", selected.id)
        .eq("invitation_type", "student")
        .eq("status", "pending")
        .limit(1);
      setHasPendingInvitation((pending || []).length > 0);
    } catch {
      // Non-fatal: if the check fails, fall back to the email prompt.
      setHasPendingInvitation(false);
    }
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
      // The account is already provisioned (no second invite needed) when the
      // case already has a linked student_user_id OR a pending invitation was
      // sent by the team at submission time.
      const accountAlreadyHandled = !!selected.student_user_id || hasPendingInvitation;

      // Fail fast: an email that already belongs to a partner/admin/team account
      // can never become a student account (one identity = one role). Catch it
      // BEFORE the case is marked paid so the admin can correct the address.
      // Only run this when we're genuinely about to create/invite an account.
      if (!accountAlreadyHandled && approveEmail.trim()) {
        try {
          const availability = await checkEmailAvailability(approveEmail.trim());
          if (!availability.available && availability.existing_role !== "student") {
            toast({
              variant: "destructive",
              description:
                identityConflictMessage(
                  {
                    code: "identity_conflict",
                    existing_role: availability.existing_role ?? undefined,
                    deactivated: availability.deactivated,
                  },
                  t,
                ) ?? t("common.actionFailed"),
            });
            setMarking(false);
            return;
          }
        } catch {
          // Availability check unavailable — fall through; the edge function
          // still enforces the rule server-side.
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      // No auto-attribution: partner commission only fires for cases where partner_id is
      // explicitly set. Cases without a partner_id get ₪0 partner commission — this is correct
      // and prevents assigning the wrong partner when multiple partners exist.

      // Call admin-mark-paid edge function to trigger record_case_commission automatically
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ case_id: selected.id }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed");

      // Create the student account at the moment the case becomes real, if it
      // doesn't exist yet AND no invitation was already sent by the team at
      // submission time. Re-inviting here would duplicate the activation link
      // the team already sent via CaseDetailPage.handleSubmitToAdmin.
      if (!accountAlreadyHandled && approveEmail.trim()) {
        const accResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-student-from-case`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            case_id: selected.id,
            student_email: approveEmail.trim(),
            student_full_name: selected.full_name,
            student_phone: selected.phone_number,
          }),
        });
        const accResult = await accResp.json().catch(() => ({}));
        if (!accResp.ok) {
          // The case is already marked paid above. A student-account conflict
          // (email belongs to a partner/admin) must not roll back enrollment,
          // but it must be surfaced clearly instead of the raw server string.
          const conflict = identityConflictMessage(accResult, t);
          toast({
            variant: "destructive",
            description:
              conflict ?? accResult?.error ?? t("admin.submissions.studentAccountFailed", "Failed to create student account."),
          });
        }
      }

      await supabase.rpc("log_user_activity" as any, {
        p_action: "MARK_ENROLLED",
        p_target_id: selected.id,
        p_target_table: "cases",
        p_details: `Marked case ${selected.full_name} as enrolled. Split: partner=${splitPreview.partnerCommission}, team=${splitPreview.teamCommission}`,
      });

      toast({ description: t("admin.submissions.enrolledSuccess") });
      setSelected(null);
      setShowSplitPanel(false);
      setApproveEmail("");
      setSplitPreview(EMPTY_SPLIT);
      await fetchCases();
    } catch (err: any) {
      console.error("[AdminSubmissions]", err);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err?.message || t("common.actionFailed"),
      });
    } finally {
      setMarking(false);
    }
  };

  const fmt = (ts: string | null) => {
    if (!ts) return "–";
    return format(new Date(ts), "dd/MM/yyyy");
  };

  // The student-documents bucket is private: never link to a public URL,
  // always mint a short-lived signed URL at click time.
  const openDocument = async (fileUrl: string) => {
    try {
      const marker = "/student-documents/";
      const idx = fileUrl.indexOf(marker);
      const path = idx !== -1 ? fileUrl.slice(idx + marker.length) : fileUrl;
      const { data, error } = await supabase.storage.from("student-documents").createSignedUrl(path, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("no url");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast({ variant: "destructive", description: err?.message ?? "Download failed" });
    }
  };

  const totalFee = (s: SubmittedCase) => (financialsMap[s.id]?.service_total ?? s.submission?.service_fee ?? 0).toLocaleString("en-US");

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden p-3 sm:p-6 space-y-4 sm:space-y-6 mx-auto">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
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
      <div className="min-w-0 max-w-full overflow-x-auto border-b border-border pb-0">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border border-b-0 transition-colors ${
            activeTab === "pending"
              ? "bg-background text-foreground border-border"
              : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
        >
          {t("admin.submissions.tabPending", "Pending Review")}
          <span
            className={`ms-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === "pending" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
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
          <span
            className={`ms-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === "completed" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {completedCases.length}
          </span>
        </button>
      </div>

      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t("common.loading")}</div>
          ) : activeTab === "pending" ? (
            cases.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {t("admin.submissions.empty", "No submitted cases yet")}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pendingPagination.items.map((c) => (
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
                <TablePagination pagination={pendingPagination as any} />
              </div>
            )
          ) : completedCases.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {t("admin.submissions.emptyCompleted", "No completed cases yet")}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {completedPagination.items.map((c) => (
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
                    <Badge className={`${toneClasses("enrolled").chip} gap-1 border hidden sm:flex`}>
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
              <TablePagination pagination={completedPagination as any} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Case Detail Dialog */}
      <Dialog open={!!selected && !showSplitPanel && !showPasswordGate} onOpenChange={() => setSelected(null)}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-auto sm:max-w-4xl max-h-[90vh] min-w-0 overflow-x-hidden overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> {selected?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              {/* Persistent status — visible on every tab. */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    selected.submission?.payment_confirmed
                      ? "bg-primary/10 text-primary"
                      : toneClasses("payment").chip
                  }
                >
                  {selected.submission?.payment_confirmed
                    ? t("admin.submissions.paymentConfirmed")
                    : t("admin.submissions.paymentPending")}
                </Badge>
                {paymentMethodMap[selected.id] && (
                  <Badge variant="outline" className="gap-1">
                    {paymentMethodMap[selected.id] === "cash" ? (
                      <Banknote className="h-3.5 w-3.5" />
                    ) : (
                      <Landmark className="h-3.5 w-3.5" />
                    )}
                    {t(
                      `finance.paymentMethod.${paymentMethodMap[selected.id]}`,
                      paymentMethodMap[selected.id] === "cash" ? "Cash" : "Bank Transfer",
                    )}
                  </Badge>
                )}
                {selected.status === "enrollment_paid" && (
                  <Badge className={`gap-1 ${toneClasses("enrolled").chip}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("admin.submissions.tabCompleted")}
                    {selected.submission?.enrollment_paid_at &&
                      ` · ${fmt(selected.submission.enrollment_paid_at)}`}
                  </Badge>
                )}
              </div>

              <SubmissionCaseTabs
                caseData={selected}
                programNames={programNames}
                accommodationNames={accommodationNames}
                paymentMethod={paymentMethodMap[selected.id]}
                serviceTotalLabel={totalFee(selected)}
                fmt={fmt}
                onOpenDocument={openDocument}
                onFinanceReadinessChange={setFinanceReadiness}
              />

              {/* Actions stay outside the tabs so they are always reachable. */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    const caseId = selected.id;
                    setSelected(null);
                    navigate(`/admin/cases/${caseId}`);
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("admin.submissions.openFullCase")}
                </Button>
                {selected.status !== "enrollment_paid" && (
                  <div className="space-y-1.5">
                    <Button
                      className="w-full gap-2"
                      onClick={openSplitPanel}
                      disabled={
                        marking ||
                        !financeReadiness ||
                        financeReadiness.germanyConfirmedRequired <
                          financeReadiness.germanyRequiredTotal
                      }
                    >
                      <SplitSquareHorizontal className="h-4 w-4" />
                      {t("admin.submissions.markEnrolled", "Mark as Enrolled")}
                    </Button>
                    {financeReadiness &&
                      financeReadiness.germanyConfirmedRequired <
                        financeReadiness.germanyRequiredTotal && (
                        <p className="text-xs text-muted-foreground">
                          {t(
                            "admin.submissions.confirmGermanPaymentsFirst",
                            "Confirm the language course and accommodation payments before marking this case as enrolled.",
                          )}
                        </p>
                      )}
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full gap-2 border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                  onClick={() => {
                    setReturnCaseId(selected.id);
                    setReturnNote("");
                  }}
                  disabled={returning}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("admin.submissions.returnForChanges", "Return for changes")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return-for-changes dialog */}
      <Dialog open={!!returnCaseId} onOpenChange={(o) => !o && setReturnCaseId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.submissions.returnDialog.title", "Return case for changes")}</DialogTitle>
            <DialogDescription>
              {t("admin.submissions.returnDialog.body", "Explain what the team member needs to fix. This note will be shown to them.")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            placeholder={t("admin.submissions.returnDialog.placeholder", "e.g. Missing passport copy, incorrect enrollment date…")}
            rows={4}
            maxLength={2000}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReturnCaseId(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!returnNote.trim() || returning}
              onClick={handleReturnCase}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {returning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {t("admin.submissions.returnDialog.confirm", "Return for changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Split Panel */}
      <Dialog
        open={showSplitPanel}
        onOpenChange={(v) => {
          if (!v) setShowSplitPanel(false);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SplitSquareHorizontal className="h-5 w-5 text-primary" />
              {t("admin.submissions.paymentSplit", "Payment Split")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t(
                "admin.submissions.paymentSplitDesc",
                "Review how the service fee will be split before confirming enrollment.",
              )}
            </p>
            <div className="space-y-2">
              {splitPreview.referralDiscount > 0 && (
                <div className={`flex justify-between p-3 rounded-lg border border-[hsl(var(--status-paid)/0.28)] ${toneClasses("paid").tint} text-sm`}>
                  <span className="text-muted-foreground">{t("admin.submissions.referralDiscount", "Referral discount applied")}</span>
                  <span className={`font-medium ${toneClasses("paid").text}`} dir="ltr">−₪{splitPreview.referralDiscount.toLocaleString("en-US")}</span>
                </div>
              )}
              <div className="flex justify-between p-3 rounded-lg bg-muted border border-border text-sm">
                <span className="text-muted-foreground">{t("admin.submissions.serviceFee")}</span>
                <span className="font-bold text-foreground">₪{splitPreview.serviceFee.toLocaleString("en-US")}</span>
              </div>
              {!splitPreview.referrer && (
                <div className="flex justify-between p-3 rounded-lg border border-border text-sm">
                  <span className="text-muted-foreground">
                    {t("admin.submissions.splitNoReferrer", "No referrer on this case")}
                  </span>
                  <span className="font-semibold text-destructive">-₪0</span>
                </div>
              )}
              {splitPreview.referrer && (
                <div className="flex items-start justify-between gap-2 p-3 rounded-lg border border-border text-sm">
                  <span className="min-w-0 text-muted-foreground">
                    <span className="block truncate">
                      {referrerRoleLabel(splitPreview.referrer.role)}: {splitPreview.referrer.name}
                    </span>
                    <span className="mt-0.5 block text-[11px]">
                      {splitPreview.referrer.customRate
                        ? t("admin.submissions.splitCustomRate", "Custom rate for this account")
                        : t("admin.submissions.splitGlobalRate", "Global default rate")}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-destructive">
                    -₪{splitPreview.referrer.amount.toLocaleString("en-US")}
                  </span>
                </div>
              )}
              <div className="flex items-start justify-between gap-2 p-3 rounded-lg border border-border text-sm">
                <span className="min-w-0 text-muted-foreground">
                  <span className="block truncate">
                    {t("admin.commission.teamMember", "Team Commission")}
                    {splitPreview.teamName ? `: ${splitPreview.teamName}` : ""}
                  </span>
                  <span className="mt-0.5 block text-[11px]">
                    {splitPreview.teamCustomRate
                      ? t("admin.submissions.splitCustomRate", "Custom rate for this account")
                      : t("admin.submissions.splitGlobalRate", "Global default rate")}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-destructive">
                  -₪{splitPreview.teamCommission.toLocaleString("en-US")}
                </span>
              </div>
              {splitPreview.agent && (
                <div className="flex items-start justify-between gap-2 p-3 rounded-lg border border-border text-sm">
                  <span className="min-w-0 text-muted-foreground">
                    <span className="block truncate">
                      {t("admin.commission.agent", "Agent")}: {splitPreview.agent.name}
                    </span>
                    <span className="mt-0.5 block text-[11px]">
                      {t("admin.submissions.splitAgentRecruit", "Recruitment share — paid on top of the partner commission")}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-destructive">
                    -₪{splitPreview.agent.amount.toLocaleString("en-US")}
                  </span>
                </div>
              )}
              {splitPreview.marginWarning && (
                <div className={`rounded-lg border border-[hsl(var(--status-danger)/0.28)] ${toneClasses("danger").tint} p-3 text-xs ${toneClasses("danger").text}`}>
                  {t(
                    "admin.submissions.splitMarginWarning",
                    "Payouts exceed the net service fee for this case — platform revenue will be ₪0.",
                  )}
                </div>
              )}

              <div className={`flex justify-between p-3 rounded-lg ${toneClasses("paid").tint} border border-[hsl(var(--status-paid)/0.28)] text-sm`}>
                <span className="font-semibold">{t("admin.commission.platformRevenue", "Platform Revenue")}</span>
                <span className={`font-bold ${toneClasses("paid").text}`}>
                  ₪{splitPreview.platformRevenue.toLocaleString("en-US")}
                </span>
              </div>
            </div>
            {(() => {
              const accountAlreadyHandled = !!selected?.student_user_id || hasPendingInvitation;
              if (accountAlreadyHandled) {
                return (
                  <div className={`flex items-center gap-2 rounded-lg border border-[hsl(var(--status-paid)/0.28)] ${toneClasses("paid").tint} p-3 text-sm ${toneClasses("paid").text}`}>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      {selected?.student_user_id
                        ? t("admin.submissions.accountAlreadyCreated", "Student account already created — no action needed.")
                        : t("admin.submissions.accountAlreadyInvited", "Student account already invited — no action needed.")}
                    </span>
                  </div>
                );
              }
              return (
                <div className="space-y-1.5 rounded-lg border border-border p-3">
                  <Label htmlFor="approve-email">{t("admin.submissions.studentEmail")}</Label>
                  <Input
                    id="approve-email"
                    type="email"
                    autoComplete="off"
                    value={approveEmail}
                    onChange={(e) => setApproveEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t("admin.submissions.approveCreatesAccount")}</p>
                </div>
              );
            })()}
            <p className="text-xs text-muted-foreground">
              {t(
                "admin.submissions.splitNote",
                "Commissions are set in Settings → Money Split. Confirm with your password to proceed.",
              )}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSplitPanel(false)}>
              {t("admin.submissions.cancel")}
            </Button>
            <Button
              onClick={() => {
                setShowSplitPanel(false);
                setShowPasswordGate(true);
              }}
              disabled={
                marking ||
                (!selected?.student_user_id &&
                  !hasPendingInvitation &&
                  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approveEmail.trim()))
              }
            >
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
            <p className="text-sm text-muted-foreground">{t("admin.submissions.confirmIdentityDesc")}</p>
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
