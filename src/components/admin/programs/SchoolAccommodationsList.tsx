import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Pencil, Pause, Play, Trash2, Plus } from "lucide-react";
import { parseTiers, formatTierLadder } from "@/components/admin/PriceTiersEditor";
import { toneClasses } from "@/lib/statusTokens";
import { cn } from "@/lib/utils";
import { Accommodation } from "./types";

const TONE = {
  new: toneClasses("new").chip,
  appointment: toneClasses("appointment").chip,
  payment: toneClasses("payment").chip,
  enrolled: toneClasses("enrolled").chip,
} as const;

const TONE_TEXT = {
  payment: toneClasses("payment").text,
} as const;

interface SchoolAccommodationsListProps {
  accommodations: Accommodation[];
  /** When false (school paused), items render muted to show the cascade. */
  schoolActive: boolean;
  onAdd?: () => void;
  onEdit: (a: Accommodation) => void;
  onToggle: (a: Accommodation) => void;
  onDelete: (a: Accommodation) => void;
}

/** Accommodations of one school; school_id is inherited from the profile. */
const SchoolAccommodationsList = ({
  accommodations,
  schoolActive,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: SchoolAccommodationsListProps) => {
  const { t } = useTranslation("dashboard");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 border-b pb-1">
        <h3 className="text-sm font-semibold">{t("admin.programs.accommodations")}</h3>
        <span className="text-xs text-muted-foreground">({accommodations.length})</span>
      </div>
      {accommodations.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {accommodations.map((a) => (
            <Card
              key={a.id}
              className={cn(
                "overflow-hidden hover:shadow-md transition-all",
                (!a.is_active || !schoolActive) && "opacity-60",
              )}
            >
              <CardContent className="p-0">
                {a.photos && a.photos.length > 0 && (
                  <div className="relative h-24 w-full">
                    <img src={a.photos[0]} alt={a.name_en} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--status-payment)/0.12)]">
                        <Home className={cn("h-4 w-4", TONE_TEXT.payment)} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.name_en}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.name_ar}</p>
                      </div>
                    </div>
                    <Badge variant={a.is_active && schoolActive ? "default" : "secondary"} className="shrink-0 text-xs">
                      {a.is_active && schoolActive
                        ? t("admin.programs.statusActive")
                        : t("admin.programs.statusInactive")}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.price != null && (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", TONE.enrolled)}>
                        💰 {a.price.toLocaleString("en-US")} {a.currency}/mo
                      </span>
                    )}
                    {a.room_type && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {a.room_type}
                      </span>
                    )}
                    {a.meals && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {a.meals}
                      </span>
                    )}
                    {a.deposit != null && (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs", TONE.new)}>
                        {t("admin.programs.labelDeposit")}: {a.deposit.toLocaleString("en-US")} {a.currency}
                      </span>
                    )}
                    {a.placement_fee != null && (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs", TONE.appointment)}>
                        {t("admin.programs.labelPlacementFee")}: {a.placement_fee.toLocaleString("en-US")} {a.currency}
                      </span>
                    )}
                    {parseTiers(a.price_tiers).length > 0 && (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs", TONE.payment)}>
                        {formatTierLadder(parseTiers(a.price_tiers), a.currency, t("admin.programs.weeksShort"))}
                      </span>
                    )}
                  </div>
                  {a.distance_note && <p className="text-xs text-muted-foreground">{a.distance_note}</p>}
                  {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
                </div>
                <div className="flex items-center justify-end gap-1 border-t bg-muted/30 px-3 py-2">
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onEdit(a)}>
                    <Pencil className="h-3 w-3" />
                    {t("admin.programs.btnEdit")}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onToggle(a)}>
                    {a.is_active ? (
                      <>
                        <Pause className="h-3 w-3" />
                        {t("admin.programs.btnPause")}
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" />
                        {t("admin.programs.btnActivate")}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(a)}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t("admin.programs.btnDelete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground py-4">{t("admin.programs.noAccommodations")}</p>
      )}
      {onAdd && (
        <Button variant="outline" size="sm" className="w-full gap-2 border-dashed" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {t("admin.programs.addAccommodationToSchool")}
        </Button>
      )}
    </section>
  );
};

export default SchoolAccommodationsList;
