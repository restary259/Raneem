import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, BadgeCheck, Clock, Pencil, Pause, Play, Trash2, Plus } from "lucide-react";
import { parseTiers } from "@/components/admin/PriceTiersEditor";
import { toneClasses } from "@/lib/statusTokens";
import { cn } from "@/lib/utils";
import { Program } from "./types";

const TONE = {
  new: toneClasses("new").chip,
  appointment: toneClasses("appointment").chip,
  payment: toneClasses("payment").chip,
  enrolled: toneClasses("enrolled").chip,
} as const;

interface SchoolProgramsListProps {
  programs: Program[];
  /** When false (school paused), items render muted to show the cascade. */
  schoolActive: boolean;
  onAdd?: () => void;
  onEdit: (p: Program) => void;
  onToggle: (p: Program) => void;
  onDelete: (p: Program) => void;
}

/**
 * Programs of one school. The school_id is inherited from the profile
 * context — adding here never asks the admin to pick a school.
 */
const SchoolProgramsList = ({ programs, schoolActive, onAdd, onEdit, onToggle, onDelete }: SchoolProgramsListProps) => {
  const { t } = useTranslation("dashboard");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 border-b pb-1">
        <h3 className="text-sm font-semibold">{t("admin.programs.programs")}</h3>
        <span className="text-xs text-muted-foreground">({programs.length})</span>
      </div>
      {programs.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {programs.map((p) => (
            <Card
              key={p.id}
              className={cn(
                "overflow-hidden hover:shadow-md transition-all",
                (!p.is_active || !schoolActive) && "opacity-60",
              )}
            >
              <CardContent className="p-0">
                {p.photos && p.photos.length > 0 && (
                  <div className="relative h-24 w-full">
                    <img src={p.photos[0]} alt={p.name_en} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.name_en}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.name_ar}</p>
                      </div>
                    </div>
                    <Badge variant={p.is_active && schoolActive ? "default" : "secondary"} className="shrink-0 text-xs">
                      {p.is_active && schoolActive
                        ? t("admin.programs.statusActive")
                        : t("admin.programs.statusInactive")}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <BadgeCheck className="h-3 w-3 me-1" />
                      {p.type.replace("_", " ")}
                    </span>
                    {p.cefr_range && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {p.cefr_range}
                      </span>
                    )}
                    {p.price != null && (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", TONE.enrolled)}>
                        💰 {p.price.toLocaleString("en-US")} {p.currency}
                      </span>
                    )}
                    {parseTiers(p.price_tiers).length > 0 && (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs", TONE.payment)}>
                        {t("admin.programs.tiersCount", { count: parseTiers(p.price_tiers).length })}
                      </span>
                    )}
                    {p.duration_in_months && (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs", TONE.new)}>
                        <Clock className="h-3 w-3 me-1" />
                        {p.duration_in_months}mo
                      </span>
                    )}
                    {p.lessons_per_week && (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs", TONE.appointment)}>
                        {p.lessons_per_week} {t("admin.programs.lessonsWk")}
                      </span>
                    )}
                    {p.fixed_start_day_of_month && (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs", TONE.payment)}>
                        {t("admin.programs.startsDay", { day: p.fixed_start_day_of_month })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 border-t bg-muted/30 px-3 py-2">
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onEdit(p)}>
                    <Pencil className="h-3 w-3" />
                    {t("admin.programs.btnEdit")}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onToggle(p)}>
                    {p.is_active ? (
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
                    onClick={() => onDelete(p)}
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
        <p className="text-center text-xs text-muted-foreground py-4">{t("admin.programs.noPrograms")}</p>
      )}
      {onAdd && (
        <Button variant="outline" size="sm" className="w-full gap-2 border-dashed" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {t("admin.programs.addProgramToSchool")}
        </Button>
      )}
    </section>
  );
};

export default SchoolProgramsList;
