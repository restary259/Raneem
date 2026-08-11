import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { CheckCircle2, Clock3, Info, Loader2, Wallet, ExternalLink, XCircle, Mail, Send } from "lucide-react";
import { formatCurrencyAmount, formatILS } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCaseServices } from "@/hooks/useCaseServices";
import { useCaseFinancials, type FinancialSchoolLine, type FinancialPayment } from "@/hooks/useCaseFinancials";
import CaseServices, { type CaseServicesHandle } from "./CaseServices";
import CasePayments from "./CasePayments";
import { formatDateTime } from "@/utils/dateUtils";

interface Props {
  caseId: string;
  canManage?: boolean;
  canConfirm?: boolean;
  /** Germany cost + verification blocks are the final step: hidden until then. */
  showGermany?: boolean;
  /** Current case status — drives the services lock and the invite gate. */
  caseStatus?: string;
  /** Student invite fields, surfaced only after the DARB payment is confirmed. */
  studentEmail?: string;
  studentFullName?: string;
  studentPhone?: string | null;
  studentUserId?: string | null;
  /**
   * The single post-payment action: submit the case to Admin, issue + email the
   * DARB invoice, and send the student dashboard invite. Provided by the page
   * so the Finance tab owns the whole finance → submission flow in one place.
   */
  onSubmitToAdmin?: () => void;
  submitting?: boolean;

  /**
   * When the page's top action bar drives the single confirm/submit action
   * (profile_completion + payment_confirmed in the tabbed layout), hide the
   * duplicate in-tab confirm button and invite/submit block.
   */
  delegateActionsToTopBar?: boolean;
  /** Live readiness snapshot pushed to the page so the top button stays in sync. */
  onReadinessChange?: (readiness: CaseFinanceReadiness) => void;
}


/** What the top "Confirm & Save" button needs to know about the Finance tab. */
export interface CaseFinanceReadiness {
  servicesSelected: boolean;
  serviceTotal: number;
  agencyConfirmed: boolean;
  agencyAck: boolean;
  confirming: boolean;
}

export interface CaseFinanceHandle {
  /** Persist services and, when the receipt checkbox is ticked, confirm the DARB fee. */
  confirmAndSave: () => Promise<void>;
  getReadiness: () => CaseFinanceReadiness;
}


interface ProofRow {
  id: string;
  case_id: string;
  payment_id: string;
  payment_type: "school_course" | "school_accommodation" | "school_insurance";
  file_path: string;
  uploaded_at: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_at: string | null;
}


const schoolPaymentTypes = ["school_course", "school_accommodation", "school_insurance"] as const;

type SchoolPaymentType = (typeof schoolPaymentTypes)[number];

const CaseFinance = forwardRef<CaseFinanceHandle, Props>(function CaseFinance(
  {
    caseId,
    canManage = false,
    canConfirm = false,
    showGermany = true,
    caseStatus,
    studentEmail,
    studentFullName,
    studentPhone,
    studentUserId,
    onSubmitToAdmin,
    submitting = false,
    delegateActionsToTopBar = false,
    onReadinessChange,
  },
  ref,
) {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const isArabic = i18n.language?.startsWith("ar");
  const { services, refetch: refetchServices } = useCaseServices(caseId);
  const { financials, refetch: refetchFinancials } = useCaseFinancials(caseId);

  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [proofBusyId, setProofBusyId] = useState<string | null>(null);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [agencyAck, setAgencyAck] = useState(false);
  const [confirmingAgency, setConfirmingAgency] = useState(false);

  /** Proof currently being rejected via the dedicated dialog (no window.prompt). */
  const [rejectTarget, setRejectTarget] = useState<ProofRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  /** Imperative handle to CaseServices so the single button can save services. */
  const servicesRef = useRef<CaseServicesHandle>(null);


  const serviceTotal = Number(financials?.service_total ?? 0);
  const paid = Number(financials?.total_confirmed ?? 0);
  const pendingReview = Number(financials?.total_pending_review ?? 0);
  const remaining = Number(financials?.remaining ?? 0);
  const schoolCosts = financials?.school_costs ?? [];
  const payments = financials?.payments ?? [];

  const schoolSubtotals = useMemo(
    () =>
      schoolCosts.reduce<Record<string, number>>((acc, line) => {
        acc[line.currency] = (acc[line.currency] ?? 0) + Number(line.total || 0);
        return acc;
      }, {}),
    [schoolCosts],
  );

  const lineName = (line: FinancialSchoolLine) =>
    (isArabic ? line.name_ar || line.name_en : line.name_en || line.name_ar) ?? "";

  const agencyPayment = payments.find((p) => p.payment_type === "agency_service" && p.status === "confirmed");
  const agencyConfirmed = !!agencyPayment;

  const loadProofs = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("case_payment_proofs")
      .select("id, case_id, payment_id, payment_type, file_path, uploaded_at, status, rejection_reason, reviewed_at")
      .eq("case_id", caseId)
      .order("uploaded_at", { ascending: false });
    if (error) {
      console.error("Failed to load Germany payment proofs:", error);
      setProofs([]);
      return;
    }
    setProofs((data ?? []) as ProofRow[]);
  }, [caseId]);

  useEffect(() => {
    void loadProofs();
  }, [loadProofs]);

  const getPaymentForType = (type: SchoolPaymentType) =>
    payments.find((p) => p.payment_type === type && p.status === "confirmed") ??
    payments.find((p) => p.payment_type === type);

  const getLatestProof = (type: SchoolPaymentType) => proofs.find((p) => p.payment_type === type);

  /** Readiness checks for the submission checklist (informational only — the
      server-side gate in submit_case_for_review stays authoritative). */
  const profileComplete =
    !!financials?.status &&
    financials.status !== "new" &&
    financials.status !== "contacted" &&
    financials.status !== "appointment_scheduled";
  const schoolSelected = !!financials?.school_id;
  const hasSchoolKind = (kind: string) => schoolCosts.some((line) => line.kind === kind);
  const germanyKinds = new Set(schoolCosts.map((line) => line.kind));
  const germanyVerified = schoolPaymentTypes.every((type) => {
    const kindOf =
      type === "school_course" ? "program" : type === "school_accommodation" ? "accommodation" : "insurance";
    if (!germanyKinds.has(kindOf)) return true;
    const proof = getLatestProof(type);
    const payment = getPaymentForType(type);
    return proof?.status === "approved" || payment?.status === "confirmed";
  });

  const typeLabel = (type: SchoolPaymentType) => {
    if (type === "school_course") return t("finance.summary.kind.program", "Language Course");
    if (type === "school_accommodation") return t("finance.summary.kind.accommodation", "Accommodation");
    return t("finance.summary.kind.insurance", "Insurance");
  };

  const openProof = async (proof: ProofRow) => {
    if (proofUrls[proof.id]) {
      window.open(proofUrls[proof.id], "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const { data, error } = await supabase.storage.from("student-documents").createSignedUrl(proof.file_path, 300);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error(t("finance.proof.linkError", "Unable to create a proof link."));
      setProofUrls((prev) => ({ ...prev, [proof.id]: data.signedUrl }));
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast({
        variant: "destructive",
        description: error?.message || t("finance.proof.openFailed", "Unable to open payment proof."),
      });
    }
  };

  const reviewProof = async (proof: ProofRow, approved: boolean, rejectionReason?: string | null) => {
    if (proofBusyId) return;
    setProofBusyId(proof.id);
    try {
      const { error } = await (supabase as any).rpc("review_case_payment_proof", {
        p_proof_id: proof.id,
        p_approved: approved,
        p_rejection_reason: approved ? null : (rejectionReason || null),
      });
      if (error) throw error;
      toast({
        description: approved
          ? t("finance.proof.confirmedToast", "Germany payment confirmed.")
          : t("finance.proof.rejectedToast", "Payment proof rejected."),
      });
      await Promise.all([loadProofs(), refetchFinancials()]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        description: error?.message || t("finance.proof.reviewFailed", "Unable to review payment proof."),
      });
    } finally {
      setProofBusyId(null);
    }
  };

  const status: "unpaid" | "partial" | "settled" =
    serviceTotal <= 0 ? "unpaid" : remaining <= 0 ? "settled" : paid > 0 ? "partial" : "unpaid";

  const statusClass =
    status === "settled"
      ? "bg-emerald-100 text-emerald-800"
      : status === "partial"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-800";

  /**
   * The single finance action.
   *
   * 1. Persist the selected DARB services (server snapshots the prices and
   *    computes the authoritative total).
   * 2. If the team has ticked the payment-confirmation checkbox and the
   *    payment has not already been confirmed, confirm the DARB agency fee
   *    via the server RPC.
   *
   * No invoice is issued and no case status changes here — submitting the
   * case to Admin remains a deliberate, separately gated step (it sends the
   * invoice and the student invite). This keeps the financial confirmation
   * and the submission decoupled, as the business rules require.
   */
  const handleConfirmAndSave = async () => {
    if (confirmingAgency) return;

    setConfirmingAgency(true);
    try {
      // 1. Save services first so the server total is current.
      const saved = servicesRef.current ? await servicesRef.current.save() : true;
      if (!saved) return;

      // 2. Confirm the DARB agency payment if the checkbox is set and not yet done.
      if (!agencyConfirmed && agencyAck && canManage) {
        const { error } = await (supabase as any).rpc("confirm_agency_service_payment", {
          p_case_id: caseId,
        });
        if (error) throw error;
        toast({
          description: `${t("finance.agency.confirmed", "DARB service payment confirmed")}: ${formatILS(serviceTotal)}`,
        });
        setAgencyAck(false);
      } else {
        toast({ description: t("finance.confirmAndSave.saved", "Finance confirmed and saved") });
      }

      await Promise.all([refetchServices(), refetchFinancials(), loadProofs()]);
    } catch (error: any) {
      console.error("Failed to confirm the DARB agency payment:", error);
      toast({
        variant: "destructive",
        description: t("finance.agency.confirmFailed", "Unable to confirm the DARB payment."),
      });
    } finally {
      setConfirmingAgency(false);
    }
  };

  /**
   * Readiness for the single button.
   *
   * The button is enabled once services are selected and (if unpaid) the
   * payment-confirmation checkbox is ticked. When everything is already
   * confirmed, the button shows a success state instead.
   */
  const servicesSelected = services.length > 0 || (servicesRef.current?.selectedCount() ?? 0) > 0;
  const financeComplete = agencyConfirmed && serviceTotal > 0;
  const canConfirmNow = canManage && serviceTotal > 0 && (!agencyConfirmed ? agencyAck : true);
  const buttonDisabled = confirmingAgency || !servicesSelected || !canConfirmNow;

  /** Live readiness snapshot for the page's top action bar. */
  const readiness = useMemo<CaseFinanceReadiness>(
    () => ({
      servicesSelected,
      serviceTotal,
      agencyConfirmed,
      agencyAck,
      confirming: confirmingAgency,
    }),
    [servicesSelected, serviceTotal, agencyConfirmed, agencyAck, confirmingAgency],
  );

  useEffect(() => {
    onReadinessChange?.(readiness);
  }, [readiness, onReadinessChange]);

  useImperativeHandle(ref, () => ({
    confirmAndSave: async () => {
      await handleConfirmAndSave();
    },
    getReadiness: () => readiness,
  }));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2">
            <Wallet className="h-5 w-5 shrink-0" />
            <span>{t("finance.title", "Finance")}</span>
          </CardTitle>
          <Badge variant="secondary" className={statusClass}>
            {t(`finance.status.${status}`, status)}
          </Badge>
        </div>
        {financials?.case_reference && (
          <p className="text-sm text-muted-foreground">
            {financials.case_reference}
            {financials.student_name ? ` · ${financials.student_name}` : ""}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-3">
          <p className="text-sm font-semibold">{t("finance.summary.agencyBlock", "DARB Services · ILS")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t("finance.summary.services", "Service total")}</p>
              <p className="mt-1 text-lg font-semibold">{formatILS(serviceTotal)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t("finance.summary.paid", "Paid")}</p>
              <p className="mt-1 text-lg font-semibold">{formatILS(paid)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t("finance.summary.pendingReview", "Pending")}</p>
              <p className="mt-1 text-lg font-semibold">{formatILS(pendingReview)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t("finance.summary.remaining", "Remaining")}</p>
              <p className="mt-1 text-lg font-semibold">{formatILS(remaining)}</p>
            </div>
          </div>

          {/* Consolidated informational note — replaces the several repeated
              explanations that used to live across the services/payments blocks. */}
          <div className="flex items-start gap-2 rounded-md border border-dashed p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {t(
                "finance.notes.priceControl",
                "Prices are controlled by the Admin service catalogue. DARB fees are calculated automatically from the selected services and cannot be edited manually.",
              )}
            </p>
          </div>
        </div>

        <Separator />

        {/* DARB SERVICES — single service-package selector. */}
        <CaseServices
          ref={servicesRef}
          caseId={caseId}
          services={services}
          canManage={canManage}
          caseStatus={caseStatus}
          onChanged={() => {
            void refetchServices();
            void refetchFinancials();
            void loadProofs();
          }}
        />

        <Separator />

        {/* PAYMENT — the confirmation card exists ONLY while the DARB fee is
            unpaid. Once confirmed it is removed entirely and the payment
            appears exactly once, inside Payment History, so it is never shown
            twice. */}
        {!agencyConfirmed && canManage && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{t("finance.agency.title", "DARB service payment")}</p>
              <Badge className="bg-red-100 text-red-800">
                {t("finance.status.unpaid", "Unpaid")}
              </Badge>
            </div>
            <p className="text-lg font-semibold">{formatILS(serviceTotal)}</p>
            <label
              htmlFor="darb-agency-ack"
              className="flex cursor-pointer items-start gap-2 rounded-md border bg-background p-3 text-sm"
            >
              <Checkbox
                id="darb-agency-ack"
                checked={agencyAck}
                onCheckedChange={(v) => setAgencyAck(v === true)}
                className="mt-0.5"
              />
              <span className="leading-tight">
                {t(
                  "finance.agency.ack",
                  "I confirm the DARB agency service fee has been received from the student.",
                )}
              </span>
            </label>
            {serviceTotal <= 0 && (
              <p className="text-xs text-amber-700">
                {t("finance.agency.needServices", "Select DARB services before confirming the payment.")}
              </p>
            )}
          </div>
        )}


        {showGermany && schoolCosts.length > 0 && (

          <>
            <Separator />
            <div className="space-y-3 rounded-md border p-4">
              <div>
                <p className="text-sm font-semibold">
                  {t("finance.summary.schoolBlock", "Germany / School Costs · EUR")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "finance.school.estimateNote",
                    "Estimated school costs. Final school invoices may differ. No ILS/EUR mixing.",
                  )}
                </p>
              </div>
              {schoolCosts.map((line) => (
                <div key={line.kind} className="rounded-md border p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{lineName(line)}</span>
                    <span className="font-semibold">{formatCurrencyAmount(line.total, line.currency)}</span>
                  </div>
                  {line.weekly_price ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCurrencyAmount(line.weekly_price, line.currency)} × {line.weeks}{" "}
                      {t("finance.summary.weeks", "weeks")}
                    </p>
                  ) : null}
                </div>
              ))}
              {Object.entries(schoolSubtotals).map(([currency, amount]) => (
                <div key={currency} className="flex justify-between border-t pt-3 font-semibold">
                  <span>{t("finance.school.estimatedTotal", "Estimated total")}</span>
                  <span>{formatCurrencyAmount(Number(amount), currency)}</span>
                </div>
              ))}
            </div>

            <Separator />
            <div className="space-y-3 rounded-md border p-4">
              <div>
                <p className="text-sm font-semibold">
                  {t("finance.verification.title", "Germany Payment Verification")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("finance.verification.hint", "Students upload proof. Only Admin can confirm or reject it.")}
                </p>
              </div>
              {schoolPaymentTypes.map((type) => {
                const proof = getLatestProof(type);
                const payment = getPaymentForType(type);
                const busy = proofBusyId === proof?.id;
                return (
                  <div key={type} className="rounded-md border p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{typeLabel(type)}</span>
                      <span className="text-sm font-semibold">
                        {payment ? formatCurrencyAmount(payment.amount, payment.currency) : "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {payment?.status === "confirmed" || proof?.status === "approved" ? (
                        <Badge className="bg-emerald-100 text-emerald-800">
                          {t("finance.verification.confirmed", "Confirmed")}
                        </Badge>
                      ) : proof?.status === "rejected" ? (
                        <Badge className="bg-red-100 text-red-800">
                          {t("finance.verification.rejected", "Proof rejected")}
                        </Badge>
                      ) : proof?.status === "pending" || payment?.status === "submitted" ? (
                        <Badge className="bg-amber-100 text-amber-800">
                          {t("finance.verification.submitted", "Proof submitted")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {t("finance.verification.awaiting", "Awaiting student proof")}
                        </Badge>
                      )}
                      {proof?.uploaded_at && (
                        <span className="text-muted-foreground">{formatDateTime(proof.uploaded_at, "—")}</span>
                      )}
                    </div>
                    {proof?.rejection_reason && <p className="text-xs text-red-700">{proof.rejection_reason}</p>}
                    {proof && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openProof(proof)}>
                          <ExternalLink className="h-3.5 w-3.5" /> {t("finance.verification.view", "View proof")}
                        </Button>
                        {canConfirm && proof.status === "pending" && (
                          <>
                            <Button size="sm" disabled={busy} onClick={() => reviewProof(proof, true)}>
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}{" "}
                              {t("finance.verification.confirmAction", "Confirm payment")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setRejectReason("");
                                setRejectTarget(proof);
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5" /> {t("finance.verification.rejectAction", "Reject proof")}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <Separator />

        {/* PAYMENT HISTORY — the single place payment records live. When the
            DARB fee is confirmed it appears here (and only here); the
            confirmation card above is removed so the payment is never shown
            twice. */}
        <CasePayments
          caseId={caseId}
          payments={payments}
          canManage={canManage}
          canConfirm={canConfirm}
          onChanged={() => void refetchFinancials()}
        />

        <Separator />

        {/* Consolidated note for third-party (Germany) payments. */}
        {schoolCosts.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-dashed p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {t(
                "finance.notes.thirdParty",
                "Language course, accommodation, and insurance payments are handled separately and verified by Admin.",
              )}
            </p>
          </div>
        )}

        <Separator />

        {/* ── Submission readiness checklist ───────────────────────────
            Shows the team member whether the case is ready to submit to
            Admin. The actual submit button and server-side gate live in
            CaseStageBlock; this block is informational only. */}
        <div className="space-y-3 rounded-md border p-4">
          <div>
            <p className="text-sm font-semibold">{t("finance.summary.submissionBlock", "Submission Status")}</p>
            <p className="text-xs text-muted-foreground">
              {t("finance.summary.submissionHint", "All items must be checked before submitting to Admin.")}
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              {profileComplete ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Clock3 className="h-4 w-4 text-amber-600" />
              )}
              <span>{t("finance.summary.checklist.profile", "Student profile complete")}</span>
            </li>
            <li className="flex items-center gap-2">
              {schoolSelected ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Clock3 className="h-4 w-4 text-amber-600" />
              )}
              <span>{t("finance.summary.checklist.school", "School selected")}</span>
            </li>
            {schoolCosts.length > 0 && (
              <>
                <li className="flex items-center gap-2">
                  {hasSchoolKind("program") ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Clock3 className="h-4 w-4 text-amber-600" />
                  )}
                  <span>{t("finance.summary.checklist.course", "Course calculated")}</span>
                </li>
                <li className="flex items-center gap-2">
                  {hasSchoolKind("accommodation") ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Clock3 className="h-4 w-4 text-amber-600" />
                  )}
                  <span>{t("finance.summary.checklist.accommodation", "Accommodation calculated")}</span>
                </li>
                <li className="flex items-center gap-2">
                  {hasSchoolKind("insurance") ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Clock3 className="h-4 w-4 text-amber-600" />
                  )}
                  <span>{t("finance.summary.checklist.insurance", "Insurance calculated")}</span>
                </li>
              </>
            )}
            <li className="flex items-center gap-2">
              {services.length > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Clock3 className="h-4 w-4 text-amber-600" />
              )}
              <span>{t("finance.summary.checklist.services", "DARB services selected")}</span>
            </li>
            <li className="flex items-center gap-2">
              {agencyConfirmed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Clock3 className="h-4 w-4 text-amber-600" />
              )}
              <span>{t("finance.summary.checklist.agencyPayment", "DARB payment confirmed")}</span>
            </li>
          </ul>
          {schoolCosts.length > 0 && (
            <p className="flex items-center gap-2 text-sm">
              {germanyVerified ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Clock3 className="h-4 w-4 text-amber-600" />
              )}
              <span>
                {germanyVerified
                  ? t("finance.summary.checklist.germanyVerified", "Germany payments verified by Admin")
                  : t("finance.summary.checklist.germanyPayment", "Germany payment — pending admin verification")}
              </span>
            </p>
          )}
        </div>

        {/* ── Create the student account & send invite ────────────────────
            This block appears ONLY after the DARB payment has been confirmed.
            It is the single action that moves the case to Admin: it submits the
            case, issues + emails the DARB invoice, and sends the student their
            dashboard activation invite. It is not shown before payment is
            confirmed, and it disappears once the case is already submitted. */}
        {canManage && !delegateActionsToTopBar && agencyConfirmed && caseStatus === "payment_confirmed" && onSubmitToAdmin && (
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">
                {t("finance.invite.title", "Create the student account & send invite")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "finance.invite.body",
                "Submit this student file to Admin. The DARB invoice is issued and emailed, and the student receives a dashboard activation link.",
              )}
            </p>
            <div className="rounded-md border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("finance.invite.recipient", "Recipient")}</span>
                <span className="font-medium">{studentFullName || studentEmail || "—"}</span>
              </div>
              {studentEmail && (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("finance.invite.email", "Email")}</span>
                  <span className="font-medium">{studentEmail}</span>
                </div>
              )}
              {studentPhone && (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("finance.invite.phone", "Phone")}</span>
                  <span className="font-medium">{studentPhone}</span>
                </div>
              )}
              {studentUserId && (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("finance.invite.account", "Student account")}</span>
                  <span className="font-medium text-emerald-700">
                    {t("finance.invite.accountExists", "Already created")}
                  </span>
                </div>
              )}
            </div>
            <Button type="button" className="w-full sm:w-auto gap-1.5" disabled={submitting} onClick={onSubmitToAdmin}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("finance.invite.action", "Submit to Admin & send invite")}
            </Button>
          </div>
        )}

        {/* Single confirmation action — delegated to the page's top bar in the
            tabbed layout (profile_completion / payment_confirmed). */}
        {canManage && !delegateActionsToTopBar && (
          <div className="space-y-2">
            {financeComplete ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {t("finance.confirmAndSave.complete", "Finance confirmed and saved")}
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={buttonDisabled}
                  onClick={handleConfirmAndSave}
                >
                  {confirmingAgency && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t("finance.confirmAndSave.action", "Confirm & Save")}
                </Button>
                {!agencyConfirmed && !agencyAck && serviceTotal > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "finance.confirmAndSave.ackRequired",
                      "Confirm that the DARB agency fee was received.",
                    )}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>

      {/* Reject-proof dialog (replaces the old window.prompt for reject reasons). */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("finance.proof.rejectTitle", "Reject payment proof")}</DialogTitle>
            <DialogDescription>
              {t("finance.proof.rejectBody", "Reason for rejecting this payment proof:")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder={t("finance.proof.rejectPlaceholder", "Add a reason (optional)…")}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={proofBusyId !== null}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={proofBusyId !== null}
              onClick={async () => {
                if (!rejectTarget) return;
                await reviewProof(rejectTarget, false, rejectReason.trim() || null);
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              {t("finance.proof.rejectAction", "Reject")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
});

export default CaseFinance;
