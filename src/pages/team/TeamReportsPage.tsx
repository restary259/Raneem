import React, { lazy } from "react";
import { useTranslation } from "react-i18next";
import { BarChart2, Table } from "lucide-react";
import TabHub, { type HubTab } from "@/components/shell/TabHub";

const TeamAnalyticsPage = lazy(() => import("./TeamAnalyticsPage"));
const TeamSpreadsheetPage = lazy(() => import("./TeamSpreadsheetPage"));

/**
 * Reports hub — analytics and the spreadsheet export were two sidebar entries
 * over the same data. `/team/spreadsheet` redirects here with `?tab=`.
 */
export default function TeamReportsPage() {
  const { t } = useTranslation("dashboard");

  const tabs: HubTab[] = [
    {
      value: "analytics",
      label: t("nav.analytics", "Analytics"),
      icon: BarChart2,
      render: () => <TeamAnalyticsPage />,
    },
    {
      value: "spreadsheet",
      label: t("nav.spreadsheet", "Spreadsheet"),
      icon: Table,
      render: () => <TeamSpreadsheetPage />,
    },
  ];

  return (
    <div className="px-4 pt-4 sm:px-6">
      <TabHub tabs={tabs} />
    </div>
  );
}
