import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  MessageSquare,
  UserCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CaseMessages from "@/components/cases/CaseMessages";
import DirectMessages from "@/components/messages/DirectMessages";
import VoiceCallButton from "@/components/messages/VoiceCallButton";
import { EmergencyNumberButtons } from "@/components/student/EmergencyCallCard";
import ThreadList, {
  type ThreadListItem,
} from "@/components/messages/ThreadList";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatFullscreen } from "@/components/messages/chatFullscreen";
import { chatDisplayName } from "@/lib/chatIdentity";
import {
  formatThreadTime,
  isVoiceAttachment,
  type ChatAttachment,
} from "@/lib/chatFormat";
import {
  listMyDirectThreads,
  type DirectThread,
} from "@/services/DirectMessageService";

type Tab = "case" | "payout" | "team";

/** One-line preview of a conversation's last message (voice notes included). */
function previewFor(
  message: { body?: string | null; attachments?: ChatAttachment[] | null } | null,
  fallback: string,
  voiceLabel: string,
): string {
  if (!message) return fallback;
  if (message.body) return message.body;
  if ((message.attachments ?? []).some(isVoiceAttachment)) return voiceLabel;
  return fallback;
}

interface OpenChat {
  tab: Tab;
  /** Case id (case tab) or direct thread id (payout/team tabs). */
  id: string;
  title: string;
}

/**
 * Student messaging: a conversation LIST that opens into a chat BOX. The list
 * holds the student's case thread, their payout thread (when one exists) and
 * the team-member thread. Opening a conversation swaps the list for the chat
 * box, whose header carries a back arrow (RTL-aware) that returns to the list.
 *
 * The student talks to "Administration" / their advisor, never to a named
 * internal account, so names go through chatDisplayName().
 */
export default function StudentMessagesPage() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [payoutThreadId, setPayoutThreadId] = useState<string | null>(null);
  const [teamThreadId, setTeamThreadId] = useState<string | null>(null);
  const [teamThreadLoading, setTeamThreadLoading] = useState(false);
  const [open, setOpen] = useState<OpenChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamThreadName, setTeamThreadName] = useState<string | null>(null);
  const [directThreads, setDirectThreads] = useState<DirectThread[]>([]);
  const isMobile = useIsMobile();
  useChatFullscreen(!!isMobile && !!open);

  const isRtl = document.documentElement.dir === "rtl";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const adminLabel = t("chat.adminLabel");

  /** Loads the student's direct threads: resolves the existing team thread,
   *  the advisor's display name, and each thread's last message + unread count. */
  const loadDirectThreads = useCallback(async () => {
    if (!user?.id) return;
    try {
      const threads = await listMyDirectThreads(user.id);
      setDirectThreads(threads);

      const existingTeam = threads.find(
        (thread: DirectThread) => thread.otherUserRole === "team_member",
      );
      if (existingTeam) {
        setTeamThreadId(existingTeam.threadId);
        setTeamThreadName(
          chatDisplayName(
            existingTeam.otherUserName,
            existingTeam.otherUserRole,
            "student",
            adminLabel,
          ),
        );
      }
    } catch {
      /* activity + names are cosmetic — the list still renders the known threads */
    }
  }, [user?.id, adminLabel]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_my_case");
      if (error) toast({ variant: "destructive", description: error.message });
      setCaseId(data?.[0]?.id ?? null);

      const { data: payouts } = await (supabase as any)
        .from("payout_requests")
        .select("thread_id")
        .not("thread_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      setPayoutThreadId(payouts?.[0]?.thread_id ?? null);

      // Resolve direct threads (activity, unread counts, existing team thread)
      // before revealing the list, so a returning student never sees an empty
      // inbox with no unread indicator.
      await loadDirectThreads();

      setLoading(false);
    })();
  }, [user?.id, toast, loadDirectThreads]);

  useEffect(() => {
    if (teamThreadId) void loadDirectThreads();
  }, [teamThreadId, loadDirectThreads]);

  /** Opens (or reuses) the student↔team-member thread and shows its chat box. */
  const openTeamThread = async () => {
    if (teamThreadId) {
      setOpen({
        tab: "team",
        id: teamThreadId,
        title: teamThreadName ?? t("messagesInbox.teamMemberTab", "Team Member"),
      });
      return;
    }
    setTeamThreadLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        "start_student_team_member_thread",
      );
      if (error) throw error;
      const id = data as string;
      setTeamThreadId(id);
      setOpen({
        tab: "team",
        id,
        title: teamThreadName ?? t("messagesInbox.teamMemberTab", "Team Member"),
      });
    } catch (err: any) {
      const noMember = /No team member assigned|No completed case/i.test(
        err.message ?? "",
      );
      toast({
        variant: "destructive",
        description: noMember
          ? t(
              "messagesInbox.teamThreadNoMember",
              "A team member hasn't been assigned to you yet — you'll be able to message them once one is.",
            )
          : err.message,
      });
    } finally {
      setTeamThreadLoading(false);
    }
  };

  /** Every conversation the student can open, with its real activity. */
  const directById = new Map(directThreads.map((thread) => [thread.threadId, thread]));
  const conversations: ThreadListItem[] = [];
  if (caseId) {
    conversations.push({
      id: `case:${caseId}`,
      type: "case",
      title: t("messagesInbox.caseTab", "Case"),
      subtitle: t(
        "messagesInbox.caseConversationHint",
        "Your case conversation with the Darb team",
      ),
      preview: t("messagesInbox.openConversation", "Open the conversation"),
      timestamp: null,
      unread: 0,
    });
  }
  if (payoutThreadId) {
    const thread = directById.get(payoutThreadId);
    conversations.push({
      id: `payout:${payoutThreadId}`,
      type: "direct",
      title: t("messagesInbox.payoutTab", "Payout"),
      subtitle: t(
        "messagesInbox.payoutConversationHint",
        "Your payout conversation",
      ),
      preview: previewFor(
        thread?.lastMessage ?? null,
        t("messagesInbox.noMessagesYet"),
        t("chat.voice.message"),
      ),
      timestamp: thread ? formatThreadTime(thread.lastMessageAt) : null,
      unread: thread?.unread ?? 0,
    });
  }
  if (teamThreadId) {
    const thread = directById.get(teamThreadId);
    conversations.push({
      id: `team:${teamThreadId}`,
      type: "direct",
      title: teamThreadName ?? t("messagesInbox.teamMemberTab", "Team Member"),
      subtitle: t(
        "messagesInbox.teamConversationHint",
        "Your direct line to your advisor",
      ),
      preview: previewFor(
        thread?.lastMessage ?? null,
        t("messagesInbox.noMessagesYet"),
        t("chat.voice.message"),
      ),
      timestamp: thread ? formatThreadTime(thread.lastMessageAt) : null,
      unread: thread?.unread ?? 0,
    });
  }

  const openFromItem = (item: ThreadListItem) => {
    const [tab, id] = item.id.split(":") as [Tab, string];
    setOpen({ tab, id, title: item.title });
  };

  /** Back arrow: leave the chat box and return to the conversation list. */
  const backToList = () => setOpen(null);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-2 p-2 md:static md:h-[calc(100vh-8rem)] md:min-h-[520px] md:gap-4 md:p-6",
        open
          ? "max-md:fixed max-md:inset-0 max-md:z-50 max-md:h-[100dvh] max-md:bg-background"
          : "h-[calc(100dvh-7.5rem)]",
      )}
    >
      {open ? (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Chat box header — the back arrow returns to the conversation list,
              and the fixed emergency numbers stay one tap away mid-chat. */}
          <div className="flex shrink-0 items-center gap-2 border-b p-2 sm:p-3">
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0"
              aria-label={t("chat.backToChats", "Back to conversations")}
              onClick={backToList}
            >
              <BackIcon className="h-4 w-4" />
            </Button>
            <p className="min-w-0 flex-1 truncate font-medium">
              {open.tab === "team" && teamThreadName
                ? teamThreadName
                : open.title}
            </p>
            <EmergencyNumberButtons />
          </div>
          {open.tab === "case" ? (
            <CaseMessages caseId={open.id} className="flex-1 overflow-hidden" />
          ) : open.tab === "team" ? (
            <>
              <DirectMessages
                threadId={open.id}
                className="flex-1 overflow-hidden"
              />
              <div className="flex items-center justify-end border-t p-2">
                <VoiceCallButton threadId={open.id} />
              </div>
            </>
          ) : (
            <DirectMessages
              threadId={open.id}
              className="flex-1 overflow-hidden"
            />
          )}
        </Card>
      ) : (
        <>
          <div>
            <h1 className="text-xl font-semibold">
              {t("messagesInbox.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("messagesInbox.studentSubtitle")}
            </p>
          </div>

          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {t("messagesInbox.noConversationYet")}
                    </p>
                  </div>
                ) : (
                  <ThreadList
                    items={conversations}
                    selectedId={null}
                    onSelect={openFromItem}
                    emptyLabel={t("messagesInbox.empty")}
                  />
                )}

                {/* Start the team-member conversation — available even before
                    one exists, so the student can always reach their advisor. */}
                {!teamThreadId && (
                  <div className="border-t p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={openTeamThread}
                      disabled={teamThreadLoading}
                    >
                      {teamThreadLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
                      )}
                      {t(
                        "messagesInbox.startTeamChat",
                        "Message my team member",
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
