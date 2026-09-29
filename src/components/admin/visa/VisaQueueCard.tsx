import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarClock,
  FolderOpen,
  FileCheck2,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import VisaStatusBadge from "./VisaStatusBadge";
import type { VisaQueueRow } from "@/services/VisaService";

const fmt = (value: string | null | undefined) => {
  if (!value) return "—";
  try {
    return format(new Date(value), "d MMM");
  } catch {
    return value;
  }
};

/**
 * One queue entry. Renders the same information set at every breakpoint: a
 * compact card on mobile, a dense row on desktop — one component, responsive
 * markup (no divergent desktop/mobile implementations to keep in sync).
 */
export default function VisaQueueCard({
  row,
  onOpen,
  onMarkArrived,
  marking,
}: {
  row: VisaQueueRow;
  onOpen: () => void;
  onMarkArrived?: () => void;
  marking?: boolean;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";
  const needsArrival = !row.actual_arrival;

  return (
    <Card className="border-border/60 transition-colors hover:border-primary/30">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {row.full_name ||
                  row.email ||
                  row.case_reference ||
                  row.case_id.slice(0, 8)}
              </span>
              <VisaStatusBadge status={row.visa_status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {row.case_reference && (
                <span className="font-mono">{row.case_reference}</span>
              )}
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {isAr ? "الوصول" : "Arrival"}: {fmt(row.actual_arrival)}
              </span>
              <span className="flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                {row.document_count} {isAr ? "ملفات" : "files"}
              </span>
              <span className="flex items-center gap-1">
                <FileCheck2 className="h-3 w-3" />
                {row.selected_document_count} {isAr ? "مختارة" : "selected"}
              </span>
              {row.assigned_name && (
                <span className="flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  {row.assigned_name}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {needsArrival && onMarkArrived && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={onMarkArrived}
                disabled={marking}
              >
                <UserCheck className="h-3 w-3" />
                {t("admin.visa.markArrived", "Mark as Arrived")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={onOpen}
            >
              {t("admin.visa.open", "Open")}
              <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
