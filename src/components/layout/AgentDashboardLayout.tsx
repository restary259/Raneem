import React from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * Agents share the same dashboard shell as the other roles. The agent role is
 * passed straight through so the shared sidebar renders the agent nav config.
 */
export default function AgentDashboardLayout() {
  return <DashboardLayout role="agent" />;
}
