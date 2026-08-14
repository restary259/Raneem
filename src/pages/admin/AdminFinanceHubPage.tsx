import React, { lazy } from "react";
import { useTranslation } from "react-i18next";
import { BarChart2, DollarSign, Table } from "lucide-react";
import TabHub, { type HubTab } from "@/components/shell/TabHub";

const AdminFinancialsPage = lazy(() => import("./AdminFinancialsPage"));
const AdminSpreadsheetPage = lazy(() => import("./AdminSpreadsheetPage"));
const AdminAnalyticsPage = lazy(() => import("./AdminAnalyticsPage"));

/**
 * Money hub — Financials, Spreadsheet and Analytics were three sidebar entries
 * over the same dataset. They are now one destination with tabs; the old
 * routes redirect here with `?tab=`.
 *
 * Each panel mounts the original page unchanged (same queries, same RLS).
 */
export default function AdminFinanceHubPage() {
  const { t } = useTranslation("dashboard");

  const tabs: HubTab[] = [
    {
      value: "finance",
      label: t("nav.financials", "Financials"),
      icon: DollarSign,
      render: () => <AdminFinancialsPage />,
    },
    {
      value: "spreadsheet",
      label: t("nav.spreadsheet", "Spreadsheet"),
      icon: Table,
      render: () => <AdminSpreadsheetPage />,
    },
    {
      value: "analytics",
      label: t("nav.analytics", "Analytics"),
      icon: BarChart2,
      render: () => <AdminAnalyticsPage />,
    },
  ];

  return (
    <div className="px-4 pt-4 sm:px-6">
      <TabHub tabs={tabs} />
    </div>
  );
}
