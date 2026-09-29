import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, Pencil } from "lucide-react";

/**
 * Arrival block for the Visa workspace.
 *
 * Shows the PLANNED arrival (`profiles.arrival_date`) and the ACTUAL arrival
 * (`visa_applications.arrived_in_germany_at`) side by side. The actual value is
 * the operational source of truth and never overwrites the planned date.
 */
export default function VisaArrivalPanel({
  plannedArrival,
  actualArrival,
  canEdit,
  onEditActual,
}: {
  plannedArrival: string | null;
  actualArrival: string | null;
  canEdit: boolean;
  onEditActual: () => void;
}) {
  const { t } = useTranslation("dashboard");

  const fmtDate = (value: string | null) => {
    if (!value) return "—";
    try {
      return format(new Date(value), "PPP");
    } catch {
      return value;
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("admin.visa.plannedArrival", "Planned arrival")}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {fmtDate(plannedArrival)}
        </p>
      </div>
      <div className="rounded-lg border border-border/70 bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("admin.visa.actualArrival", "Actual arrival")}
          </p>
          {actualArrival ? (
            <Badge
              variant="outline"
              className="border-0 bg-[hsl(var(--status-enrolled)/0.14)] text-[hsl(var(--status-enrolled))]"
            >
              <CalendarCheck className="me-1 h-3 w-3" />
              {t("admin.visa.arrived", "Arrived")}
            </Badge>
          ) : null}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            {actualArrival
              ? fmtDate(actualArrival)
              : t("admin.visa.notConfirmed", "Not confirmed yet")}
          </p>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={onEditActual}
            >
              <Pencil className="h-3 w-3" />
              {t("common.edit", "Edit")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
