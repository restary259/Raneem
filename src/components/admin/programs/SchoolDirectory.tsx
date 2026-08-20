import React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GraduationCap, AlertTriangle } from "lucide-react";
import { Program, School, Accommodation, UNASSIGNED_KEY } from "./types";

interface SchoolDirectoryProps {
  schools: School[];
  programs: Program[];
  accommodations: Accommodation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Left column of the Programs Hub: a compact, health-at-a-glance directory.
 * Each card shows the school's location plus live program/accommodation
 * counts so admins can spot empty or mis-linked schools without opening them.
 */
const SchoolDirectory = ({ schools, programs, accommodations, selectedId, onSelect }: SchoolDirectoryProps) => {
  const { t } = useTranslation("dashboard");

  const programCount = (schoolId: string) => programs.filter((p) => p.school_id === schoolId).length;
  const accomCount = (schoolId: string) => accommodations.filter((a) => a.school_id === schoolId).length;

  // Programs/accommodations without a school are unreachable in Submit New
  // Student (that wizard queries strictly by school_id), so surface them here.
  const unassigned =
    programs.filter((p) => !p.school_id || !schools.some((s) => s.id === p.school_id)).length +
    accommodations.filter((a) => !a.school_id || !schools.some((s) => s.id === a.school_id)).length;

  return (
    <div className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("admin.programs.schoolsDirectory")}
      </h2>
      <div className="space-y-2">
        {schools.map((s) => {
          const selected = selectedId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              aria-current={selected}
              className={cn(
                "w-full rounded-lg border bg-card p-3 text-start transition-colors hover:border-primary/50",
                selected ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border",
                !s.is_active && "opacity-60",
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{s.name_en}</p>
                    <Badge variant={s.is_active ? "default" : "secondary"} className="shrink-0 text-[10px] px-1.5 py-0">
                      {s.is_active ? t("admin.programs.statusActive") : t("admin.programs.statusInactive")}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[s.city, s.country].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("admin.programs.programsCount", { count: programCount(s.id) })}
                    {" · "}
                    {t("admin.programs.accommodationsCount", { count: accomCount(s.id) })}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
        {schools.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            {t("admin.programs.noSchools")}
          </p>
        )}
      </div>
      {unassigned > 0 && (
        <button
          type="button"
          onClick={() => onSelect(UNASSIGNED_KEY)}
          aria-current={selectedId === UNASSIGNED_KEY}
          className={cn(
            "w-full rounded-lg border border-dashed p-3 text-start transition-colors",
            selectedId === UNASSIGNED_KEY
              ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500"
              : "border-amber-500/50 bg-amber-500/5 hover:border-amber-500",
          )}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs font-medium text-amber-700 dark:text-amber-500">
              {t("admin.programs.unassignedWarning", { count: unassigned })}
            </p>
          </div>
        </button>
      )}
    </div>
  );
};

export default SchoolDirectory;
