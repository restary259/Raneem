import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock3, FileText, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toneClasses } from "@/lib/statusTokens";

interface ProofRow {
  id: string;
  payment_type: string;
  file_path: string;
  uploaded_at: string;
  status: "pending" | "approved" | "rejected";
}

const TYPE_KEYS: Record<string, [string, string]> = {
  school_course: ["studentFees.proofType.course", "Language course"],
  school_accommodation: ["studentFees.proofType.accommodation", "Accommodation"],
  school_insurance: ["studentFees.proofType.insurance", "Insurance"],
};

/** Payment proofs the signed-in student uploaded on the Fees page. */
export default function StudentPaymentProofsList() {
  const { t } = useTranslation("dashboard");
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data: cases, error: caseErr } = await supabase.rpc("get_my_case");
    if (caseErr) {
      setError(t("studentFees.proofsLoadError", "We couldn't load your payment proofs."));
      return;
    }
    const myCase = Array.isArray(cases) ? cases[0] : null;
    if (!myCase?.id) return;
    const { data, error: readErr } = await (supabase as any)
      .from("case_payment_proofs")
      .select("id, payment_type, file_path, uploaded_at, status")
      .eq("case_id", myCase.id)
      .order("uploaded_at", { ascending: false });
    if (readErr) {
      setError(t("studentFees.proofsLoadError", "We couldn't load your payment proofs."));
      return;
    }
    setProofs((data ?? []) as ProofRow[]);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (path: string) => {
    const { data, error: urlErr } = await supabase.storage.from("student-documents").createSignedUrl(path, 300);
    if (urlErr || !data?.signedUrl) {
      setError(t("studentFees.viewFileError", "Unable to open the file."));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (!error && proofs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("studentFees.paymentProofsTitle", "Payment proofs")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {proofs.map((p) => {
          const [key, fallback] = TYPE_KEYS[p.payment_type] ?? ["studentFees.proofType.other", "Payment"];
          const fileName = p.file_path.split("/").pop() ?? p.file_path;
          return (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{t(key, fallback)}</p>
                <p className="truncate text-xs text-muted-foreground">{fileName}</p>
                {p.status === "approved" ? (
                  <p className={`flex items-center gap-1 text-xs ${toneClasses("enrolled").text}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t("studentFees.paymentConfirmedByAdmin", "Payment confirmed by Admin")}
                  </p>
                ) : p.status === "rejected" ? (
                  <p className={`flex items-center gap-1 text-xs ${toneClasses("danger").text}`}>
                    <XCircle className="h-3.5 w-3.5" /> {t("studentFees.proofRejected", "Payment proof rejected")}
                  </p>
                ) : (
                  <p className={`flex items-center gap-1 text-xs ${toneClasses("payment").text}`}>
                    <Clock3 className="h-3.5 w-3.5" /> {t("studentFees.proofUploaded", "Uploaded — waiting for review")}
                  </p>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={() => void open(p.file_path)}>
                <FileText className="me-2 h-4 w-4" /> {t("studentFees.viewFile", "View file")}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
