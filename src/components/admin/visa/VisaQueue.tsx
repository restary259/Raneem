import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell";
import TablePagination from "@/components/common/TablePagination";
import { usePagination } from "@/hooks/usePagination";
import {
  CheckCircle2,
  Clock,
  Plane,
  ThumbsUp,
  XCircle,
  CalendarOff,
  Inbox,
} from "lucide-react";
import VisaQueueCard from "./VisaQueueCard";
import {
  VISA_QUEUE_SECTIONS,
  groupVisaQueue,
  type VisaQueueSection,
} from "@/lib/visaStatus";
import type { VisaQueueRow } from "@/services/VisaService";

const SECTION_META: Record<
  VisaQueueSection,
  {
    icon: typeof Inbox;
    i18nKey: string;
    fallback: string;
    emptyKey: string;
    emptyFallback: string;
  }
> = {
  ready: {
    icon: Plane,
    i18nKey: "admin.visa.ready",
    fallback: "Ready",
    emptyKey: "admin.visa.emptyReady",
    emptyFallback: "No students are ready for the post-arrival Visa workflow.",
  },
  inProgress: {
    icon: Clock,
    i18nKey: "admin.visa.inProgress",
    fallback: "In Progress",
    emptyKey: "admin.visa.emptyInProgress",
    emptyFallback: "No visa applications in progress.",
  },
  approved: {
    icon: ThumbsUp,
    i18nKey: "admin.visa.approved",
    fallback: "Approved",
    emptyKey: "admin.visa.emptyApproved",
    emptyFallback: "No approved visas yet.",
  },
  rejected: {
    icon: XCircle,
    i18nKey: "admin.visa.rejected",
    fallback: "Rejected",
    emptyKey: "admin.visa.emptyRejected",
    emptyFallback: "No rejected visas.",
  },
  received: {
    icon: CheckCircle2,
    i18nKey: "admin.visa.received",
    fallback: "Received",
    emptyKey: "admin.visa.emptyReceived",
    emptyFallback: "No completed visa files yet.",
  },
  missingArrival: {
    icon: CalendarOff,
    i18nKey: "admin.visa.missingArrival",
    fallback: "Missing Arrival Date",
    emptyKey: "admin.visa.emptyMissingArrival",
    emptyFallback: "Every enrolled student has a confirmed arrival date.",
  },
};

/**
 * The Visa queue. Sections are derived from the pure `groupVisaQueue` helper so
 * the bucketing rules are unit-tested independently of this markup. The
 * "Missing Arrival Date" section is intentionally last and always rendered when
 * non-empty, so enrolled students are never silently hidden.
 */
export default function VisaQueue({
  rows,
  activeSection,
  onSectionChange,
  onOpen,
  onMarkArrived,
  markingCaseId,
}: {
  rows: VisaQueueRow[];
  activeSection: VisaQueueSection;
  onSectionChange: (s: VisaQueueSection) => void;
  onOpen: (row: VisaQueueRow) => void;
  onMarkArrived: (row: VisaQueueRow) => void;
  markingCaseId: string | null;
}) {
  const { t } = useTranslation("dashboard");
  const grouped = groupVisaQueue(rows);
  const pagination = usePagination(grouped[activeSection], 25);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {VISA_QUEUE_SECTIONS.map((section) => {
          const meta = SECTION_META[section];
          const active = activeSection === section;
          const count = grouped[section].length;
          return (
            <Button
              key={section}
              variant={active ? "default" : "outline"}
              size="sm"
              className="h-8 gap-2 text-xs"
              onClick={() => onSectionChange(section)}
            >
              <meta.icon className="h-3.5 w-3.5" />
              {t(meta.i18nKey, meta.fallback)}
              <Badge
                variant="outline"
                className={`border-0 px-1.5 py-0 text-[10px] tabular-nums ${
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

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
                  activeSection === "missingArrival"
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
