import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import BankDetailsEditor from "@/components/common/BankDetailsEditor";

/**
 * Agent bank-details surface (`/agent/earnings?tab=bank`, reached from the
 * `/agent/bank-details` redirect). Renders the ONE shared editor used by
 * partners and ambassadors too — the previous standalone agent form was merged
 * into `BankDetailsEditor` so the fields, validation and payload stay identical
 * across every payout-earning role.
 */
export default function AgentBankDetailsPage() {
  const { user } = useAuth();
  if (!user) return <DashboardLoading />;
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <BankDetailsEditor userId={user.id} />
    </div>
  );
}
