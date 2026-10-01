import React, { lazy } from "react";
import { useTranslation } from "react-i18next";
import { FileCheck, GitBranch, Globe } from "lucide-react";
import TabHub, { type HubTab } from "@/components/shell/TabHub";

const AdminPipelinePage = lazy(() => import("./AdminPipelinePage"));
const AdminSubmissionsPage = lazy(() => import("./AdminSubmissionsPage"));
const AdminVisaPage = lazy(() => import("./AdminVisaPage"));

/**
 * Unified case workspace: Pipeline, Submissions and Visa live in one
 * URL-addressable tab group instead of separate destinations.
 *
 * /admin/submissions and /admin/visa remain compatibility redirects into
 * this hub so existing bookmarks and internal links keep working.
 *
 * Visa is deliberately NOT a cases.status; it is an operational workflow
 * layered on enrolled cases.
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
    {
      value: "visa",
      label: t("nav.visa", "Visa"),
      icon: Globe,
      render: () => <AdminVisaPage />,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
      <TabHub tabs={tabs} />
    </div>
  );
}
