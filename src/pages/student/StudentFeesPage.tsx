import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Receipt, Upload, CheckCircle2, Clock3, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { formatCurrencyAmount } from "@/lib/money";

interface ServiceLine {
  id: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  currency: string;
}
interface PaymentLine {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_type: string | null;
  created_at: string;
}
interface SchoolCost {
  kind: "program" | "accommodation" | "insurance";
  name_ar: string | null;
  name_en: string | null;
  total: number;
  currency: string;
}
interface ProofRow {
  id: string;
  payment_id: string;
  payment_type: string;
  file_path: string;
  uploaded_at: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
}
interface Financials {
  case_id: string;
  case_reference: string | null;
  services: ServiceLine[];
  service_total: number;
  school_costs: SchoolCost[];
  payments: PaymentLine[];
  total_confirmed: number;
  total_pending_review: number;
  remaining: number;
}

const typeForKind = (kind: SchoolCost["kind"]) =>
  kind === "program" ? "school_course" : kind === "accommodation" ? "school_accommodation" : "school_insurance";

const StudentFeesPage = () => {
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";
  const [loading, setLoading] = useState(true);
  const [fin, setFin] = useState<Financials | null>(null);
  const [invoiceToken, setInvoiceToken] = useState<string | null>(null);
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: cases } = await supabase.rpc("get_my_case");
    const myCase = Array.isArray(cases) ? cases[0] : null;
    if (!myCase?.id) {
      setLoading(false);
      return;
    }

    const [{ data: financials }, { data: invoice }, { data: proofRows }] = await Promise.all([
      supabase.rpc("get_case_financials", { p_case_id: myCase.id }),
      supabase
        .from("case_invoices")
        .select("public_token, issued_at")
        .eq("case_id", myCase.id)
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from("case_payment_proofs")
        .select("id, payment_id, payment_type, file_path, uploaded_at, status, rejection_reason")
        .eq("case_id", myCase.id)
        .order("uploaded_at", { ascending: false }),
    ]);

    if (financials) setFin(financials as unknown as Financials);
    if (invoice?.public_token) setInvoiceToken(invoice.public_token);
    setProofs((proofRows ?? []) as ProofRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadProof = async (kind: SchoolCost["kind"], file: File) => {
    if (!fin) return;
    const paymentType = typeForKind(kind);
    setUploadingType(paymentType);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("You must be signed in.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${fin.case_id}_payment-proof_${paymentType}_${Date.now()}_${safeName}`;
      const { data: uploaded, error: uploadError } = await supabase.storage
        .from("student-documents")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { error } = await (supabase as any).rpc("submit_case_payment_proof", {
        p_case_id: fin.case_id,
        p_payment_type: paymentType,
        p_file_path: uploaded.path,
        p_note: null,
      });
      if (error) throw error;
      await load();
    } catch (error: any) {
      console.error("Payment proof upload failed", error);
      window.alert(error?.message || "Unable to upload payment proof.");
    } finally {
      setUploadingType(null);
    }
  };

  if (loading) return <DashboardLoading />;

  if (!fin) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("studentFees.noCase", "No case is linked to your account yet.")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const stat = (label: string, value: number) => (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{formatCurrencyAmount(value, "ILS")}</p>
    </div>
  );

  const latestProof = (type: string) => proofs.find((p) => p.payment_type === type);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-xl font-bold">{t("studentFees.title", "Fees & invoice")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("studentFees.subtitle", "Your DARB service fees and Germany payment verification.")}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" /> DARB agency services · ILS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {stat("Service total", fin.service_total)}
            {stat("Confirmed", fin.total_confirmed)}
            {stat("Pending", fin.total_pending_review)}
            {stat("Remaining", fin.remaining)}
          </div>
          {fin.services?.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {fin.services.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span>{s.description}</span>
                  <span className="font-medium">{formatCurrencyAmount(s.line_total, s.currency || "ILS")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {fin.school_costs?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Germany / School costs · EUR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              These are estimated school costs. Final school invoices may differ.
            </p>
            {fin.school_costs.map((c) => {
              const type = typeForKind(c.kind);
              const proof = latestProof(type);
              const payment = fin.payments.find((p) => p.payment_type === type);
              const busy = uploadingType === type;
              return (
                <div key={c.kind} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{(isRtl ? c.name_ar : c.name_en) || c.name_en || c.name_ar}</span>
                    <span className="font-semibold">{formatCurrencyAmount(c.total, c.currency || "EUR")}</span>
                  </div>
                  {payment?.status === "confirmed" || proof?.status === "approved" ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Payment confirmed by Admin
                    </div>
                  ) : proof?.status === "rejected" ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-red-700">
                        <XCircle className="h-4 w-4" /> Payment proof rejected
                      </div>
                      <p className="text-xs text-red-700">
                        {proof.rejection_reason || "Please upload a replacement proof."}
                      </p>
                      <label className="inline-flex">
                        <input
                          className="hidden"
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadProof(c.kind, f);
                          }}
                        />
                        <Button asChild size="sm" variant="outline">
                          <span>
                            <Upload className="me-2 h-4 w-4" /> Upload replacement
                          </span>
                        </Button>
                      </label>
                    </div>
                  ) : proof?.status === "pending" || payment?.status === "submitted" ? (
                    <div className="flex items-center gap-2 text-sm text-amber-700">
                      <Clock3 className="h-4 w-4" /> Proof submitted — awaiting Admin verification
                    </div>
                  ) : (
                    <label className="inline-flex">
                      <input
                        className="hidden"
                        type="file"
                        accept="image/*,.pdf"
                        disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadProof(c.kind, f);
                        }}
                      />
                      <Button asChild size="sm">
                        <span>
                          {busy ? (
                            <Loader2 className="me-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="me-2 h-4 w-4" />
                          )}{" "}
                          Upload payment proof
                        </span>
                      </Button>
                    </label>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("studentFees.payments", "Payments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {fin.payments?.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {fin.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString("en-US")}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{p.status}</Badge>
                    <span className="font-medium">{formatCurrencyAmount(p.amount, p.currency || "ILS")}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("studentFees.noPayments", "No payments yet.")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> {t("studentFees.invoice", "Invoice")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoiceToken ? (
            <Button asChild variant="outline">
              <a href={`/invoice/${invoiceToken}`} target="_blank" rel="noreferrer">
                {t("studentFees.viewInvoice", "View invoice")}
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("studentFees.noInvoice", "No invoice has been issued yet.")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentFeesPage;
