import React, { lazy } from "react";
import { useTranslation } from "react-i18next";
import { BarChart2, Crown } from "lucide-react";
import TabHub, { type HubTab } from "@/components/shell/TabHub";

const PartnerNetworkPage = lazy(() => import("./PartnerNetworkPage"));
const PartnerPerformancePage = lazy(() => import("./PartnerPerformancePage"));

/**
 * Master-partner network hub. Performance was a thin standalone page about the
 * same recruited network, so it is now a tab here.
 * `/partner/performance` redirects to `?tab=performance`.
 *
 * Both panels keep their own master-partner guard, so access is unchanged.
 */
export default function PartnerNetworkHubPage() {
  const { t } = useTranslation("dashboard");

  const tabs: HubTab[] = [
    {
      value: "network",
      label: t("nav.network", "Network"),
      icon: Crown,
      render: () => <PartnerNetworkPage />,
    },
    {
      value: "performance",
      label: t("nav.performance", "Performance"),
      icon: BarChart2,
      render: () => <PartnerPerformancePage />,
    },
  ];

  return (
    <div className="px-4 pt-4 sm:px-6">
      <TabHub tabs={tabs} />
    </div>
  );
}
