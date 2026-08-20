import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Pause, Play, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { School } from "./types";

interface SchoolInfoCardProps {
  school: School;
  onEdit: (school: School) => void;
  onToggleActive: (school: School) => void;
}

/** Header of the school profile: identity, photos, status and actions. */
const SchoolInfoCard = ({ school, onEdit, onToggleActive }: SchoolInfoCardProps) => {
  const { t } = useTranslation("dashboard");

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              school.is_active ? "bg-primary/10" : "bg-muted",
            )}
          >
            <GraduationCap className={cn("h-5 w-5", school.is_active ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-tight">{school.name_en}</h2>
            {school.name_ar && <p className="text-sm text-muted-foreground">{school.name_ar}</p>}
            <p className="text-xs text-muted-foreground">
              {[school.city, school.country].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge variant={school.is_active ? "default" : "secondary"} className="text-xs">
            {school.is_active ? t("admin.programs.statusActive") : t("admin.programs.statusInactive")}
          </Badge>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onEdit(school)}>
            <Pencil className="h-3.5 w-3.5" />
            {t("admin.programs.btnEdit")}
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onToggleActive(school)}>
            {school.is_active ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                {t("admin.programs.btnPause")}
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                {t("admin.programs.btnActivate")}
              </>
            )}
          </Button>
        </div>
      </div>
      {school.photos && school.photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {school.photos.slice(0, 4).map((src) => (
            <div key={src} className="relative h-20 overflow-hidden rounded-md">
              <img src={src} alt={school.name_en} className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SchoolInfoCard;
