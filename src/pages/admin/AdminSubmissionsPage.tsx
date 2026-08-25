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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  RefreshCw,
  ChevronRight,
  Download,
  FileText,
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
import { useNavigate } from "react-router-dom";
import { CopyButton } from "@/components/common/CopyButton";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/common/TablePagination";
import CaseInvoiceBlock from "@/components/admin/CaseInvoiceBlock";
import CaseFinance from "@/components/cases/CaseFinance";
import { useCaseFinancials } from "@/hooks/useCaseFinancials";
import { identityConflictMessage } from "@/lib/identityConflict";
import { checkEmailAvailability } from "@/lib/checkEmailAvailability";
import { sendCaseMessage } from "@/services/CaseMessageService";


interface SubmittedCase {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  source: string;
  created_at: string;
  education_level: string | null;
  city: string | null;
  passport_type: string | null;
  student_user_id: string | null;
  partner_id: string | null;
  referred_by: string | null;
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
    program_price: number | null;
    program_weeks: number | null;
    program_weekly_price: number | null;
    accommodation_price: number | null;
    accommodation_weeks: number | null;
    accommodation_weekly_price: number | null;
    extra_data: Record<string, unknown> | null;
  } | null;
  documents?: Array<{ id: string; file_name: string; file_url: string; category: string; created_at: string }>;
}

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
      setSplitPreview({ serviceFee: 0, referralDiscount: 0, partners: [], partnerCommission: 0, teamCommission: 0, agent: null, platformRevenue: 0 });
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
    <div className="p-4 sm:p-6 space-y-6 w-full max-w-[1600px] mx-auto">
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

      <Card>
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
                <h3 className="text-sm font-semibold text-foreground mb-2">{t("admin.submissions.basicInfo")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.phone")}:</span>
                    <div className="flex items-center gap-1">
                      <p className="font-medium">{selected.phone_number}</p>
                      <CopyButton value={selected.phone_number} />
                    </div>
                  </div>
                  {(() => {
                    // Manual / submit-new-student cases never collect these
                    // intake fields; fall back to extra_data, then say so
                    // explicitly instead of rendering a blank dash.
                    const extra = (selected.submission?.extra_data ?? {}) as Record<string, unknown>;
                    const na = t("admin.submissions.notCollected");
                    const cityVal = selected.city || (extra.city as string) || "";
                    const eduVal = selected.education_level || (extra.education_level as string) || "";
                    const passVal = (selected.passport_type || (extra.passport_type as string) || "").replace(
                      /_/g,
                      " ",
                    );
                    return (
                      <>
                        <div>
                          <span className="text-muted-foreground">{t("admin.submissions.city")}:</span>
                          <div className="flex items-center gap-1">
                            <p className={cityVal ? "font-medium" : "text-muted-foreground italic"}>{cityVal || na}</p>
                            {cityVal && <CopyButton value={cityVal} />}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("admin.submissions.education")}:</span>
                          <div className="flex items-center gap-1">
                            <p className={eduVal ? "font-medium" : "text-muted-foreground italic"}>{eduVal || na}</p>
                            {eduVal && <CopyButton value={eduVal} />}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("admin.submissions.passport")}:</span>
                          <div className="flex items-center gap-1">
                            <p className={passVal ? "font-medium" : "text-muted-foreground italic"}>{passVal || na}</p>
                            {passVal && <CopyButton value={passVal} />}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.submittedDate")}:</span>
                    <div className="flex items-center gap-1">
                      <p className="font-medium">{fmt(selected.submission?.submitted_at || null)}</p>
                      {selected.submission?.submitted_at && (
                        <CopyButton value={fmt(selected.submission.submitted_at)} />
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("admin.submissions.payment")}:</span>
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
                  </div>
                  {paymentMethodMap[selected.id] && (
                    <div>
                      <span className="text-muted-foreground">{t("finance.paymentMethod.label", "Payment method")}:</span>
                      <div className="flex items-center gap-1">
                        {paymentMethodMap[selected.id] === "cash" ? <Banknote className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />}
                        <p className="font-medium">
                          {t(`finance.paymentMethod.${paymentMethodMap[selected.id]}`, paymentMethodMap[selected.id] === "cash" ? "Cash" : "Bank Transfer")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Payment Details */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{t("admin.submissions.paymentDetails")}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">DARB service total:</span>
                    <p className="font-medium">Calculated in the Finance section above.</p>
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
                          {selected.submission?.program_price ? (
                            <p className="text-xs text-muted-foreground">
                              {selected.submission?.program_weeks && selected.submission?.program_weekly_price
                                ? `${selected.submission.program_weeks} × €${Number(selected.submission.program_weekly_price).toLocaleString("en-US")} = `
                                : ""}
                              €{Number(selected.submission.program_price).toLocaleString("en-US")}
                            </p>
                          ) : null}
                        </div>
                      )}
                      {selected.submission?.accommodation_id && (
                        <div>
                          <span className="text-muted-foreground">{t("admin.submissions.accommodation")}:</span>
                          <p className="font-medium">
                            {accommodationNames?.[selected.submission.accommodation_id] ||
                              selected.submission.accommodation_id}
                          </p>
                          {selected.submission?.accommodation_price ? (
                            <p className="text-xs text-muted-foreground">
                              {selected.submission?.accommodation_weeks &&
                              selected.submission?.accommodation_weekly_price
                                ? `${selected.submission.accommodation_weeks} × €${Number(selected.submission.accommodation_weekly_price).toLocaleString("en-US")} = `
                                : ""}
                              €{Number(selected.submission.accommodation_price).toLocaleString("en-US")}
                            </p>
                          ) : null}
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

              <CaseFinance caseId={selected.id} canManage={false} canConfirm={true} />

              <CaseInvoiceBlock caseId={selected.id} caseStatus={selected.status} />

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
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 shrink-0"
                            onClick={() => openDocument(doc.file_url)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Enrolled badge for completed cases */}
              {selected.status === "enrollment_paid" && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${toneClasses("enrolled").tint} border border-[hsl(var(--status-enrolled)/0.28)]`}>
                  <CheckCircle2 className={`h-5 w-5 ${toneClasses("enrolled").text} shrink-0`} />
                  <div className="text-sm">
                    <p className={`font-semibold ${toneClasses("enrolled").text}`}>{t("admin.submissions.tabCompleted")}</p>
                    {selected.submission?.enrollment_paid_at && (
                      <p className={`${toneClasses("enrolled").text} text-xs`}>
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
                    navigate(`/admin/cases/${caseId}`);
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
              {splitPreview.partners.length === 0 && (
                <div className="flex justify-between p-3 rounded-lg border border-border text-sm">
                  <span className="text-muted-foreground">{t("admin.commission.partner", "Partner Commission")}</span>
                  <span className="font-semibold text-destructive">-₪0</span>
                </div>
              )}
              {splitPreview.partners.map((p) => (
                <div key={p.partnerId} className="flex justify-between p-3 rounded-lg border border-border text-sm">
                  <span className="text-muted-foreground">
                    {t("admin.commission.partner", "Partner")}: {p.name}
                  </span>
                  <span className="font-semibold text-destructive">-₪{p.amount.toLocaleString("en-US")}</span>
                </div>
              ))}
              <div className="flex justify-between p-3 rounded-lg border border-border text-sm">
                <span className="text-muted-foreground">{t("admin.commission.teamMember", "Team Commission")}</span>
                <span className="font-semibold text-destructive">
                  -₪{splitPreview.teamCommission.toLocaleString("en-US")}
                </span>
              </div>
              {splitPreview.agent && (
                <div className="flex justify-between p-3 rounded-lg border border-border text-sm">
                  <span className="text-muted-foreground">
                    {t("admin.commission.agent", "Agent")}: {splitPreview.agent.name}
                  </span>
                  <span className="font-semibold text-destructive">
                    -₪{splitPreview.agent.amount.toLocaleString("en-US")}
                  </span>
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
