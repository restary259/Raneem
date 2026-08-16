import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus } from "lucide-react";
import { toneClasses } from "@/lib/statusTokens";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatFullscreen } from "@/components/messages/chatFullscreen";
import DirectMessages from "@/components/messages/DirectMessages";
import { chatDisplayName } from "@/lib/chatIdentity";
import ThreadList, { type ThreadListItem } from "@/components/messages/ThreadList";
import StaffPickerDialog from "@/components/messages/StaffPickerDialog";
import {
  listMyDirectThreads,
  startDirectThread,
  type DirectThread,
} from "@/services/DirectMessageService";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";

/**
 * Partners and ambassadors talk directly with the Darb admins. This component
 * is also reused by the Agent dashboard (via the `viewerRole` prop) — agents
 * chat with admins under the same direct-thread infrastructure.
 */
export default function PartnerMessagesPage({ viewerRole = "social_media_partner" }: { viewerRole?: string }) {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const online = useOnlineUsers();
  const isMobile = useIsMobile();

  const [threads, setThreads] = useState<DirectThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [staffOpen, setStaffOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const rows = await listMyDirectThreads(user.id);
      setThreads(rows);
      // Do NOT auto-select the first thread on load — the inbox opens on the
      // conversation list and the user explicitly picks one to open it.
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openDirectWith = async (staffId: string) => {
    try {
      const threadId = await startDirectThread(staffId);
      setStaffOpen(false);
      setSelected(threadId);
      await load();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const displayName = (name: string | null | undefined, role: string | null | undefined) =>
    chatDisplayName(name, role, viewerRole, t("chat.adminLabel"));

  const items: ThreadListItem[] = threads.map((thread) => ({
    id: thread.threadId,
    type: "direct",
    title: displayName(thread.otherUserName, thread.otherUserRole),
    subtitle: thread.otherUserRole
      ? t(`case.messages.role.${thread.otherUserRole}`, thread.otherUserRole)
      : null,
    preview:
      thread.lastMessage?.kind === "payout_request"
        ? t("chat.payout.title")
        : thread.lastMessage?.body || t("messagesInbox.noMessagesYet"),
    timestamp: thread.lastMessageAt,
    unread: thread.unread,
    otherUserId: thread.otherUserId,
  }));

  useChatFullscreen(!!isMobile && !!selected);

  const active = threads.find((thread) => thread.threadId === selected) ?? null;

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-0 flex-col gap-2 p-2 md:h-[calc(100vh-8rem)] md:min-h-[520px] md:gap-4 md:p-6">
      <div className={cn("flex-wrap items-center justify-between gap-3 md:flex", selected ? "hidden" : "flex")}>
        <div>
          <h1 className="text-xl font-semibold">{t("messagesInbox.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("messagesInbox.partnerSubtitle")}</p>
        </div>
        <StaffPickerDialog
          open={staffOpen}
          onOpenChange={setStaffOpen}
          excludeUserId={user?.id}
          onlineUserIds={online}
          onSelect={openDirectWith}
          trigger={
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              {t("messagesInbox.newDirect")}
            </Button>
          }
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[300px_1fr]">
        <Card className={cn("min-h-0 flex-col overflow-hidden md:flex", selected ? "hidden" : "flex")}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ThreadList
                items={items}
                selectedId={selected}
                onSelect={(item) => setSelected(item.id)}
                emptyLabel={t("messagesInbox.empty")}
                onlineUserIds={online}
              />
            )}
          </div>
        </Card>

        <Card
          className={cn(
            "min-h-0 flex-col overflow-hidden md:flex md:rounded-lg md:border",
            selected
              ? "flex max-md:fixed max-md:inset-0 max-md:z-50 max-md:h-[100dvh] max-md:rounded-none max-md:border-0 max-md:shadow-none"
              : "hidden",
          )}
        >
          {active ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {displayName(active.otherUserName, active.otherUserRole)}
                  </p>
                  {active.otherUserId && online.has(active.otherUserId) && (
                    <p className={`flex items-center gap-1 text-[11px] ${toneClasses("enrolled").text}`}>
                      <span className={`h-2 w-2 rounded-full ${toneClasses("enrolled").dot}`} />
                      {t("chat.presence.online")}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="md:hidden"
                  onClick={() => setSelected(null)}
                >
                  {t("chat.back")}
                </Button>
              </div>
              <DirectMessages
                threadId={active.threadId}
                className="flex min-h-0 flex-1 flex-col"
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">{t("messagesInbox.selectThread")}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
