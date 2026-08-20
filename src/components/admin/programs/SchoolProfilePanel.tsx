import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import SchoolInfoCard from "./SchoolInfoCard";
import SchoolProgramsList from "./SchoolProgramsList";
import SchoolAccommodationsList from "./SchoolAccommodationsList";
import { Program, School, Accommodation, UNASSIGNED_KEY } from "./types";

interface SchoolProfilePanelProps {
  /** Selected school id, UNASSIGNED_KEY, or null when nothing is selected. */
  selectedId: string | null;
  school: School | null;
  programs: Program[];
  accommodations: Accommodation[];
  onEditSchool: (s: School) => void;
  onToggleSchool: (s: School) => void;
  onAddProgram: () => void;
  onEditProgram: (p: Program) => void;
  onToggleProgram: (p: Program) => void;
  onDeleteProgram: (p: Program) => void;
  onAddAccommodation: () => void;
  onEditAccommodation: (a: Accommodation) => void;
  onToggleAccommodation: (a: Accommodation) => void;
  onDeleteAccommodation: (a: Accommodation) => void;
}

/**
 * Right column of the Programs Hub. Shows either a full school profile,
 * the unassigned-items buckets, or a prompt to pick a school.
 */
const SchoolProfilePanel = ({
  selectedId,
  school,
  programs,
  accommodations,
  onEditSchool,
  onToggleSchool,
  onAddProgram,
  onEditProgram,
  onToggleProgram,
  onDeleteProgram,
  onAddAccommodation,
  onEditAccommodation,
  onToggleAccommodation,
  onDeleteAccommodation,
}: SchoolProfilePanelProps) => {
  const { t } = useTranslation("dashboard");

  if (!selectedId) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm text-muted-foreground">{t("admin.programs.selectSchoolPrompt")}</p>
      </div>
    );
  }

  const isUnassigned = selectedId === UNASSIGNED_KEY;

  if (isUnassigned) {
    // Items to which no school is linked are unreachable in Submit New
    // Student; this view lets the admin find and re-link them.
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-500">
              {t("admin.programs.unassignedTitle")}
            </p>
            <p className="text-xs text-muted-foreground">{t("admin.programs.unassignedNote")}</p>
          </div>
        </div>
        <SchoolProgramsList
          programs={programs}
          schoolActive
          onEdit={onEditProgram}
          onToggle={onToggleProgram}
          onDelete={onDeleteProgram}
        />
        <SchoolAccommodationsList
          accommodations={accommodations}
          schoolActive
          onEdit={onEditAccommodation}
          onToggle={onToggleAccommodation}
          onDelete={onDeleteAccommodation}
        />
      </div>
    );
  }

  if (!school) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-sm text-muted-foreground">{t("admin.programs.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SchoolInfoCard school={school} onEdit={onEditSchool} onToggleActive={onToggleSchool} />
      <SchoolProgramsList
        programs={programs}
        schoolActive={school.is_active}
        onAdd={onAddProgram}
        onEdit={onEditProgram}
        onToggle={onToggleProgram}
        onDelete={onDeleteProgram}
      />
      <SchoolAccommodationsList
        accommodations={accommodations}
        schoolActive={school.is_active}
        onAdd={onAddAccommodation}
        onEdit={onEditAccommodation}
        onToggle={onToggleAccommodation}
        onDelete={onDeleteAccommodation}
      />
    </div>
  );
};

export default SchoolProfilePanel;
