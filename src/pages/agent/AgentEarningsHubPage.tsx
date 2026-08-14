import React, { lazy } from "react";
import { useTranslation } from "react-i18next";
import { Landmark, TrendingUp } from "lucide-react";
import TabHub, { type HubTab } from "@/components/shell/TabHub";

const AgentEarningsPage = lazy(() => import("./AgentEarningsPage"));
const AgentBankDetailsPage = lazy(() => import("./AgentBankDetailsPage"));

/**
 * Agent money hub. Bank details had no sidebar entry — payout details belong
 * next to earnings, so they are a tab here. `/agent/bank-details` redirects to
 * `?tab=bank`.
 */
export default function AgentEarningsHubPage() {
  const { t } = useTranslation("dashboard");

  const tabs: HubTab[] = [
    {
      value: "earnings",
      label: t("nav.earnings", "Earnings"),
      icon: TrendingUp,
      render: () => <AgentEarningsPage />,
    },
    {
      value: "bank",
      label: t("nav.bankDetails", "Bank details"),
      icon: Landmark,
      render: () => <AgentBankDetailsPage />,
    },
  ];

  return (
    <div className="px-4 pt-4 sm:px-6">
      <TabHub tabs={tabs} />
    </div>
  );
}
