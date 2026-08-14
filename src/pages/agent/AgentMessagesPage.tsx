/**
 * Agent messages: reuse the shared direct-messages inbox (admin threads) with
 * the agent viewer role so admins render as "Administration" rather than by
 * real name. The underlying start_direct_thread/get_staff_directory RPCs allow
 * agents (added in the agent role foundation migration).
 */
import PartnerMessagesPage from "@/pages/messages/PartnerMessagesPage";

export function AgentMessagesPage() {
  return <PartnerMessagesPage viewerRole="agent" />;
}

export default AgentMessagesPage;
