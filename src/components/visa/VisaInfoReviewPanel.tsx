import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionCard } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getVisaInfo, reviewVisaInfo, type VisaInfoRecord } from "@/services/VisaInfoService";
import VisaInfoFieldsView, { VisaInfoStatusBadge } from "./VisaInfoFieldsView";

/** Staff (team/admin) view of the student's Visa Information with review actions. */
export default function VisaInfoReviewPanel({ caseId }: { caseId: string | null }) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [rec, setRec] = useState<VisaInfoRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [askNote, setAskNote] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!caseId) return;
    setError(null);
    try {
      setRec(await getVisaInfo(caseId));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (decision: "checked" | "needs_correction") => {
    if (!caseId) return;
    if (decision === "needs_correction" && note.trim() === "") {
      toast({ variant: "destructive", title: t("visaInfo.noteRequired") });
      return;
    }
    setBusy(true);
    try {
      await reviewVisaInfo(caseId, decision, note.trim());
      setAskNote(false);
      setNote("");
      await load();
      toast({ title: t(`visaInfo.status.${decision}`) });
    } catch (e: any) {
      toast({ variant: "destructive", title: t("visaInfo.saveError"), description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  if (!caseId) return null;

  return (
    <SectionCard title={t("visaInfo.title")} actions={rec ? <VisaInfoStatusBadge status={rec.status} /> : undefined}>
      {error ? (
        <div className="space-y-2 text-sm">
          <p className="text-destructive">{t("visaInfo.loadError")}</p>
          <Button size="sm" variant="outline" onClick={() => void load()}>{t("visaInfo.retry")}</Button>
        </div>
      ) : !rec ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Object.keys(rec.info).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("visaInfo.staffEmpty")}</p>
      ) : (
        <div className="space-y-4">
          {rec.correctionNote && (
            <p className="rounded-md border border-border bg-muted p-2 text-sm">
              <strong>{t("visaInfo.correctionNote")}:</strong> {rec.correctionNote}
            </p>
          )}
          <VisaInfoFieldsView data={rec.info} showGerman />
          {rec.status === "submitted" && (
            <div className="space-y-2">
              {askNote && (
                <Textarea value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)}
                  placeholder={t("visaInfo.notePlaceholder")} />
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => void decide("checked")}>{t("visaInfo.markChecked")}</Button>
                <Button size="sm" variant="outline" disabled={busy}
                  onClick={() => (askNote ? void decide("needs_correction") : setAskNote(true))}>
                  {t("visaInfo.needsCorrection")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
