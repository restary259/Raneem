import { MessageCircleMore, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "@/lib/router-compat";
import SegmentedTabs from "@/components/shell/SegmentedTabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import CaseMessagesInboxPage from "@/pages/messages/CaseMessagesInboxPage";
import WhatsAppInboxPage from "@/pages/messages/WhatsAppInboxPage";

type TeamInboxTab = "messages" | "whatsapp";

const isTeamInboxTab = (value: string | null): value is TeamInboxTab =>
  value === "messages" || value === "whatsapp";

export default function TeamInboxPage() {
  const { t } = useTranslation("dashboard");
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: TeamInboxTab = isTeamInboxTab(requestedTab) ? requestedTab : "messages";

  const changeTab = (value: string) => {
    const next: TeamInboxTab = value === "whatsapp" ? "whatsapp" : "messages";
    setSearchParams({ tab: next }, { replace: true });
  };

  return (
    <Tabs value={tab} onValueChange={changeTab} className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 border-0 border-b-0 bg-background px-2 py-2 shadow-none sm:px-6">
        <SegmentedTabs
          items={[
            {
              value: "messages",
              icon: MessageSquare,
              label: t("messagesInbox.staffTab", "Messages"),
            },
            {
              value: "whatsapp",
              icon: MessageCircleMore,
              label: t("messagesInbox.whatsappTab", "WhatsApp"),
            },
          ]}
        />
      </div>

      <TabsContent value="messages" className="m-0 min-h-0 min-w-0 flex-1">
        <CaseMessagesInboxPage />
      </TabsContent>
      <TabsContent value="whatsapp" className="m-0 min-h-0 min-w-0 flex-1 px-2 sm:px-6">
        <WhatsAppInboxPage embedded canManageTemplates={role === "admin"} inboxOnly={role !== "admin"} />
      </TabsContent>
    </Tabs>
  );
}