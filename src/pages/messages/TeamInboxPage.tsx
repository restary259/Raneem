import { MessageCircleMore, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import SegmentedTabs from "@/components/shell/SegmentedTabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import CaseMessagesInboxPage from "@/pages/messages/CaseMessagesInboxPage";
import WhatsAppInboxPage from "@/pages/messages/WhatsAppInboxPage";

type TeamInboxTab = "messages" | "whatsapp";

const isTeamInboxTab = (value: string | null): value is TeamInboxTab =>
  value === "messages" || value === "whatsapp";

export default function TeamInboxPage() {
  const { t } = useTranslation("dashboard");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: TeamInboxTab = isTeamInboxTab(requestedTab) ? requestedTab : "messages";

  const changeTab = (value: string) => {
    const next: TeamInboxTab = value === "whatsapp" ? "whatsapp" : "messages";
    setSearchParams({ tab: next }, { replace: true });
  };

  return (
    <Tabs value={tab} onValueChange={changeTab} className="flex h-full min-h-0 flex-col">
      {/* main already starts below the app header, so the bar sticks at its own
          top edge (`top-0`); `top-14` pushed it down over the page heading. */}
      <div className="sticky top-0 z-20 shrink-0 border-b bg-background/95 px-2 py-2 backdrop-blur sm:px-6">
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

      {/* Both panels live in the same flex column: the tab strip is a fixed row
          and the active panel fills the rest. The flex context sits one level
          below `TabsContent` on purpose - an inactive panel keeps the `[hidden]`
          attribute, and giving `TabsContent` a `display` utility would override
          the preflight `[hidden]` rule, letting the empty hidden panel still
          consume space in the column. */}
      <TabsContent value="messages" className="mt-0 min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col">
          <CaseMessagesInboxPage />
        </div>
      </TabsContent>
      <TabsContent value="whatsapp" className="mt-0 min-h-0 flex-1 px-2 sm:px-6">
        <div className="flex h-full min-h-0 flex-col">
          <WhatsAppInboxPage embedded />
        </div>
      </TabsContent>
    </Tabs>
  );
}