import React, { lazy } from "react";
import { useTranslation } from "react-i18next";
import { BarChart2, Crown, UserPlus } from "lucide-react";
import TabHub, { type HubTab } from "@/components/shell/TabHub";

const AgentNetworkPage = lazy(() => import("./AgentNetworkPage"));
const AgentRecruitPage = lazy(() => import("./AgentRecruitPage"));
const AgentAnalyticsPage = lazy(() => import("./AgentAnalyticsPage"));

/**
 * Agent network hub. Recruiting and network analytics were routes with no
 * sidebar entry at all (unreachable without a deep link); they are now tabs of
 * the Network destination. Old routes redirect here with `?tab=`.
 */
export default function AgentNetworkHubPage() {
  const { t } = useTranslation("dashboard");

  const tabs: HubTab[] = [
    {
      value: "network",
      label: t("nav.network", "Network"),
      icon: Crown,
      render: () => <AgentNetworkPage />,
    },
    {
      value: "recruit",
      label: t("nav.recruit", "Recruit"),
      icon: UserPlus,
      render: () => <AgentRecruitPage />,
    },
    {
      value: "performance",
      label: t("nav.performance", "Performance"),
      icon: BarChart2,
      render: () => <AgentAnalyticsPage />,
    },
  ];

  return (
    <div className="px-4 pt-4 sm:px-6">
      <TabHub tabs={tabs} />
    </div>
  );
}
