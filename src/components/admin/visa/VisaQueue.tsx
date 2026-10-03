import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/shell";
import TablePagination from "@/components/common/TablePagination";
import { usePagination } from "@/hooks/usePagination";
import { Clock, FileCheck2, type LucideIcon } from "lucide-react";
import VisaQueueCard from "./VisaQueueCard";
import { groupVisaQueue, type VisaQueueSection } from "@/lib/visaStatus";
import type { VisaQueueRow } from "@/services/VisaService";

const SECTION_META: Record<
  VisaQueueSection,
  {
    icon: LucideIcon;
    emptyKey: string;
    emptyFallback: string;
  }
> = {
  pending: {
    icon: Clock,
    emptyKey: "admin.visa.emptyPending",
    emptyFallback: "No enrolled students are waiting for their Visa file.",
  },
  applied: {
    icon: FileCheck2,
    emptyKey: "admin.visa.emptyApplied",
    emptyFallback: "No Visa files have been submitted for administration.",
  },
};

/**
 * The Visa queue for the section the viewer picked. Sections are derived from
 * the pure `groupVisaQueue` helper so the bucketing rules are unit-tested
 * independently of this markup. The Pending intentionally includes students
 * without arrival confirmation because enrollment and Visa preparation are
 * separate stages and may be months apart.
 *
 * Section switching lives in the page's KPI row — this component no longer
 * renders a second set of section buttons.
 */
export default function VisaQueue({
  rows,
  activeSection,
  onOpen,
  onMarkArrived,
  markingCaseId,
}: {
  rows: VisaQueueRow[];
  activeSection: VisaQueueSection;
  onOpen: (row: VisaQueueRow) => void;
  onMarkArrived: (row: VisaQueueRow) => void;
  markingCaseId: string | null;
}) {
  const { t } = useTranslation("dashboard");
  const grouped = groupVisaQueue(rows);
  const pagination = usePagination(grouped[activeSection], 25);

  return (
    <div className="space-y-4">
      {grouped[activeSection].length === 0 ? (
        <EmptyState
          icon={SECTION_META[activeSection].icon}
          title={t(
            SECTION_META[activeSection].emptyKey,
            SECTION_META[activeSection].emptyFallback,
          )}
        />
      ) : (
        <>
          <div className="space-y-2">
            {pagination.items.map((row) => (
              <VisaQueueCard
                key={row.case_id}
                row={row}
                onOpen={() => onOpen(row)}
                onMarkArrived={
                  activeSection === "pending" && !row.actual_arrival
                    ? () => onMarkArrived(row)
                    : undefined
                }
                marking={markingCaseId === row.case_id}
              />
            ))}
          </div>
          {pagination.pageCount > 1 && (
            <TablePagination pagination={pagination as never} />
          )}
        </>
      )}
    </div>
  );
}
