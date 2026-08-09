import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock3, Loader2, Wallet, ExternalLink, XCircle } from "lucide-react";
import { formatILS } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCaseServices } from "@/hooks/useCaseServices";
import { useCaseFinancials, type FinancialSchoolLine, type FinancialPayment } from "@/hooks/useCaseFinancials";
import CaseServices from "./CaseServices";
import CasePayments from "./CasePayments";

interface Props {
  caseId: string;
  canManage?: boolean;
  canConfirm?: boolean;
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

const fmtMoney = (amount: number, currency: string) =>
  currency === "ILS"
    ? formatILS(amount)
    : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(
        Number(amount || 0),
      );

const fmtDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

const schoolPaymentTypes = ["school_course", "school_accommodation", "school_insurance"] as const;

type SchoolPaymentType = (typeof schoolPaymentTypes)[number];

const CaseFinance: React.FC<Props> = ({ caseId, canManage = false, canConfirm = false }) => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const isArabic = i18n.language?.startsWith("ar");
  const { services, refetch: refetchServices } = useCaseServices(caseId);
  const { financials, refetch: refetchFinancials } = useCaseFinancials(caseId);

  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [proofBusyId, setProofBusyId] = useState<string | null>(null);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

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
      if (!data?.signedUrl) throw new Error("Unable to create a proof link.");
      setProofUrls((prev) => ({ ...prev, [proof.id]: data.signedUrl }));
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast({ variant: "destructive", description: error?.message || "Unable to open payment proof." });
    }
  };

  const reviewProof = async (proof: ProofRow, approved: boolean) => {
    if (proofBusyId) return;
    setProofBusyId(proof.id);
    try {
      const reason = approved
        ? null
        : window.prompt("Reason for rejecting this payment proof:") || "Payment proof rejected by Admin.";
      if (!approved && !reason) return;
      const { error } = await (supabase as any).rpc("review_case_payment_proof", {
        p_proof_id: proof.id,
        p_approved: approved,
        p_rejection_reason: reason,
      });
      if (error) throw error;
      toast({ description: approved ? "Germany payment confirmed." : "Payment proof rejected." });
      await Promise.all([loadProofs(), refetchFinancials()]);
    } catch (error: any) {
      toast({ variant: "destructive", description: error?.message || "Unable to review payment proof." });
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

          <div
            className={`rounded-md border p-4 ${agencyConfirmed ? "border-emerald-200 bg-emerald-50/50" : "bg-muted/30"}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {agencyConfirmed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Clock3 className="h-4 w-4 text-amber-600" />
                  )}
                  <p className="text-sm font-semibold">DARB service payment</p>
                </div>
                <p className="mt-1 text-sm font-medium">{formatILS(serviceTotal)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {agencyConfirmed
                    ? `Confirmed by ${agencyPayment?.confirmed_by ? "Team/Admin" : "Team"} · ${fmtDate(agencyPayment?.confirmed_at ?? null)}`
                    : "Calculated automatically from selected DARB services. No amount can be entered manually."}
                </p>
              </div>
              {!agencyConfirmed && canManage && (
                <Button
                  type="button"
                  disabled={serviceTotal <= 0}
                  onClick={async () => {
                    try {
                      const { error } = await (supabase as any).rpc("confirm_agency_service_payment", {
                        p_case_id: caseId,
                      });
                      if (error) throw error;
                      toast({ description: `DARB service payment confirmed: ${formatILS(serviceTotal)}` });
                      await refetchFinancials();
                    } catch (error: any) {
                      toast({
                        variant: "destructive",
                        description: error?.message || "Unable to confirm the DARB payment.",
                      });
                    }
                  }}
                >
                  Confirm DARB Payment
                </Button>
              )}
            </div>
          </div>
        </div>

        {schoolCosts.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3 rounded-md border p-4">
              <div>
                <p className="text-sm font-semibold">
                  {t("finance.summary.schoolBlock", "Germany / School Costs · EUR")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Estimated school costs. Final school invoices may differ. No ILS/EUR mixing.
                </p>
              </div>
              {schoolCosts.map((line) => (
                <div key={line.kind} className="rounded-md border p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{lineName(line)}</span>
                    <span className="font-semibold">{fmtMoney(line.total, line.currency)}</span>
                  </div>
                  {line.weekly_price ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmtMoney(line.weekly_price, line.currency)} × {line.weeks} weeks
                    </p>
                  ) : null}
                </div>
              ))}
              {Object.entries(schoolSubtotals).map(([currency, amount]) => (
                <div key={currency} className="flex justify-between border-t pt-3 font-semibold">
                  <span>Estimated total</span>
                  <span>{fmtMoney(Number(amount), currency)}</span>
                </div>
              ))}
            </div>

            <Separator />
            <div className="space-y-3 rounded-md border p-4">
              <div>
                <p className="text-sm font-semibold">Germany Payment Verification</p>
                <p className="text-xs text-muted-foreground">
                  Students upload proof. Only Admin can confirm or reject it.
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
                        {payment ? fmtMoney(payment.amount, payment.currency) : "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {payment?.status === "confirmed" || proof?.status === "approved" ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Confirmed</Badge>
                      ) : proof?.status === "rejected" ? (
                        <Badge className="bg-red-100 text-red-800">Proof rejected</Badge>
                      ) : proof?.status === "pending" || payment?.status === "submitted" ? (
                        <Badge className="bg-amber-100 text-amber-800">Proof submitted</Badge>
                      ) : (
                        <Badge variant="secondary">Awaiting student proof</Badge>
                      )}
                      {proof?.uploaded_at && (
                        <span className="text-muted-foreground">{fmtDate(proof.uploaded_at)}</span>
                      )}
                    </div>
                    {proof?.rejection_reason && <p className="text-xs text-red-700">{proof.rejection_reason}</p>}
                    {proof && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openProof(proof)}>
                          <ExternalLink className="h-3.5 w-3.5" /> View proof
                        </Button>
                        {canConfirm && proof.status === "pending" && (
                          <>
                            <Button size="sm" disabled={busy} onClick={() => reviewProof(proof, true)}>
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}{" "}
                              Confirm payment
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => reviewProof(proof, false)}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject proof
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
        <CaseServices
          caseId={caseId}
          services={services}
          canManage={canManage}
          onChanged={() => {
            void refetchServices();
            void refetchFinancials();
            void loadProofs();
          }}
        />
        <Separator />
        <CasePayments
          caseId={caseId}
          payments={payments}
          canManage={canManage}
          canConfirm={canConfirm}
          onChanged={() => void refetchFinancials()}
        />
      </CardContent>
    </Card>
  );
};

export default CaseFinance;
