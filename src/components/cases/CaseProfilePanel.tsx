import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CaseProfileForm from "./CaseProfileForm";
import CaseProfileSummary from "./CaseProfileSummary";
import {
  missingProfileFields,
  PROFILE_FIELD_LABEL_KEYS,
  readStudentProfile,
  type StudentProfileValues,
} from "@/lib/studentProfileFields";

interface Props {
  status: string;
  caseData: Record<string, any>;
  submission: Record<string, any> | null;
  canManage: boolean;
  onRefresh: () => void;
}

/** The student-file surface of the case pipeline. Once the profile is complete  
    the long form collapses into a read-only summary, reopened only on demand  
    (extracted from CaseStageBlock so it can be embedded in the tabbed layout). */
export default function CaseProfilePanel({ status, caseData, submission, canManage, onRefresh }: Props) {
  const { t } = useTranslation("dashboard");
  const [editingProfile, setEditingProfile] = useState(false);

  const values = readStudentProfile(caseData, submission);
  const missing = missingProfileFields(values);
  const savedComplete = !!submission?.profile_completed_at && missing.length === 0;
  const reopened = submission?.review_status === "changes_requested";
  const fieldName = (f: keyof StudentProfileValues) => t(PROFILE_FIELD_LABEL_KEYS[f]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t("case.detail.completeProfile")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "profile_completion" && reopened && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <p className="text-sm font-medium text-amber-700">{t("case.submit.changesRequested")}</p>
            {submission?.review_note && <p className="mt-1 text-sm text-muted-foreground">{submission.review_note}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("case.submit.fixAndResend", {
                defaultValue: "Make the requested change below, save the file, then send it back to admin.",
              })}
            </p>
          </div>
        )}

        {status === "profile_completion" && savedComplete && !editingProfile ? (
          <>
            <CaseProfileSummary caseData={caseData} submission={submission} />
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-emerald-700 dark:text-emerald-400">{t("case.profileSaved")}</p>
              {canManage && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditingProfile(true)}>
                  <Pencil className="h-4 w-4" />
                  {t("case.editProfile")}
                </Button>
              )}
            </div>
          </>
        ) : status === "payment_confirmed" && !editingProfile ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t("case.detail.editProfileDesc", {
                defaultValue: "You can still correct the student file before sending it to admin.",
              })}
            </p>
            {canManage && (
              <Button variant="outline" className="gap-1.5" onClick={() => setEditingProfile(true)}>
                <Pencil className="h-4 w-4" />
                {t("case.detail.editProfile", { defaultValue: "Edit student profile" })}
              </Button>
            )}
          </>
        ) : (
          <>
            <CaseProfileForm caseData={caseData} submission={submission} onSaved={onRefresh} />
            {savedComplete && (
              <Button variant="outline" size="sm" onClick={() => setEditingProfile(false)}>
                {t("common.done", { defaultValue: "Done" })}
              </Button>
            )}
          </>
        )}

        {status === "profile_completion" && !savedComplete && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <p className="text-sm font-medium text-amber-700">{t("case.detail.paymentBlocked")}</p>
            {missing.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">{missing.map(fieldName).join(" · ")}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
