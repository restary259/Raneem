import React, { lazy } from "react";
import { useTranslation } from "react-i18next";
import { FileCheck, GitBranch } from "lucide-react";
import TabHub, { type HubTab } from "@/components/shell/TabHub";

const AdminPipelinePage = lazy(() => import("./AdminPipelinePage"));
const AdminSubmissionsPage = lazy(() => import("./AdminSubmissionsPage"));

/**
 * Case-state hub — the pipeline board and the submissions review queue are two
 * views of the same cases, so they live under one destination.
 * `/admin/submissions` redirects here with `?tab=submissions`.
 */
export default function AdminPipelineHubPage() {
  const { t } = useTranslation("dashboard");

  const tabs: HubTab[] = [
    {
      value: "pipeline",
      label: t("nav.pipeline", "Pipeline"),
      icon: GitBranch,
      render: () => <AdminPipelinePage />,
    },
    {
      value: "submissions",
      label: t("nav.submissions", "Submissions"),
      icon: FileCheck,
      render: () => <AdminSubmissionsPage />,
    },
  ];

  return (
    <div className="px-4 pt-4 sm:px-6">
      <TabHub tabs={tabs} />
    </div>
  );
}
