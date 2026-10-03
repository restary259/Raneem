import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  KpiRow,
  LoadingState,
  ErrorState,  type KpiItem,
} from "@/components/shell";
import {
  RefreshCw,
  Clock,
  FileCheck2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVisaQueue } from "@/hooks/useVisaQueue";
import { visaQueueCounts, type VisaQueueSection } from "@/lib/visaStatus";
import {
  markStudentArrived,
  visaErrMsg,
  type VisaQueueRow,
} from "@/services/VisaService";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import VisaQueue from "@/components/admin/visa/VisaQueue";
import VisaDetailSheet from "@/components/admin/visa/VisaDetailSheet";

/**
 * Admin Visa — the post-enrollment visa work queue.
 *
 * It reads ENROLLED cases (`enrollment_paid`) with a student account. Visa is
 * never a `cases.status`; the case stays enrolled while the visa workflow
 * advances independently. This page adds no new status store and no new
 * document storage — it operates on the canonical `visa_field_values` and the
 * shared `documents` records.
 */
export default function AdminVisaPage() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const { rows, loading, error, refresh } = useVisaQueue();
  const [section, setSection] = useState<VisaQueueSection>("pending");
  const [selected, setSelected] = useState<VisaQueueRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [markingCaseId, setMarkingCaseId] = useState<string | null>(null);

  const counts = visaQueueCounts(rows);

  const kpis: KpiItem[] = [
    {
      key: "pending",
      label: t("admin.visa.pending", "Pending"),
      value: counts.pending,
      icon: Clock,
      onClick: () => setSection("pending"),
    },
    {
      key: "applied",
      label: t("admin.visa.applied", "Visa Applied"),
      value: counts.applied,
      icon: FileCheck2,
      onClick: () => setSection("applied"),
    },
  ];

  const openRow = (row: VisaQueueRow) => {
    setSelected(row);
    setSheetOpen(true);
  };

  const markArrived = async (row: VisaQueueRow) => {
    if (!row.student_user_id) return;
    setMarkingCaseId(row.case_id);
    try {
      await markStudentArrived(
        row.case_id,
        row.student_user_id,
        user?.id ?? null,
      );
      toast({ description: t("admin.visa.arrivedToast", "Arrival recorded.") });
      await refresh();
    } catch (e) {
      toast({
        variant: "destructive",
        description: `${t("admin.visa.errArrival", "Failed to record arrival")}: ${visaErrMsg(e)}`,
      });
    } finally {
      setMarkingCaseId(null);
    }
  };

  // Keep the open detail in sync with the refreshed queue row.
  const selectedRow = selected
    ? (rows.find((r) => r.case_id === selected.case_id) ?? selected)
    : null;

  return (
    <div>
      <div className="flex justify-end">
        <h1 className="sr-only">{t("admin.visa.title", "Visa")}</h1>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          {t("common.refresh", "Refresh")}
        </Button>
      </div>

      {error && rows.length === 0 ? (
        <ErrorState
          title={t("common.error", "Something went wrong")}
          onRetry={() => void refresh()}
        />
      ) : (
        <div className="space-y-4">
          <KpiRow items={kpis} columns={4} />

          {loading && rows.length === 0 ? (
            <LoadingState variant="rows" rows={5} />
          ) : (
            <VisaQueue
              rows={rows}
              activeSection={section}
              onSectionChange={setSection}
              onOpen={openRow}
              onMarkArrived={markArrived}
              markingCaseId={markingCaseId}
            />
          )}
        </div>
      )}

      <VisaDetailSheet
        row={selectedRow}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onChanged={() => void refresh()}
      />
    </div>
  );
}
