import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CaseMessages from "@/components/cases/CaseMessages";
import DirectMessages from "@/components/messages/DirectMessages";
import VoiceCallButton from "@/components/messages/VoiceCallButton";
import {
  EMERGENCY_NUMBERS,
  EmergencyNumberButtons,
} from "@/components/student/EmergencyCallCard";
import ThreadList, {
  type ThreadListItem,
} from "@/components/messages/ThreadList";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatFullscreen } from "@/components/messages/chatFullscreen";
import { chatDisplayName } from "@/lib/chatIdentity";
import { isVoiceAttachment, type ChatAttachment } from "@/lib/chatFormat";
import {
  listMyDirectThreads,
  type DirectThread,
} from "@/services/DirectMessageService";

type Tab = "case" | "payout" | "team";

/** One-line preview of a conversation's last message (voice notes included). */
function previewFor(
  message: { body?: string | null; attachments?: ChatAttachment[] | null } | null,
  fallback: string,
  attachmentLabel: string,
  voiceLabel: string,
): string {
  if (!message) return fallback;
  if (message.body) return message.body;
  const attachments = message.attachments ?? [];
  if (attachments.some(isVoiceAttachment)) return voiceLabel;
  if (attachments.length > 0) return attachmentLabel;
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
 * the team-member thread plus emergency call contacts. Opening a conversation
 * swaps the list for the chat box, whose header carries a back arrow (RTL-aware)
 * that returns to the list.
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

  /** Every conversation/contact the student can open, with the requested order.
   *  The Team Member row is always present; when the thread does not exist yet,
   *  selecting it starts the existing team-member thread RPC. Emergency services
   *  are rendered separately below as call-only contacts using the existing
   *  German emergency numbers (110 / 112), never as fake chat threads. */
  const directById = new Map(directThreads.map((thread) => [thread.threadId, thread]));
  const teamThread: ThreadListItem = {
    id: teamThreadId ? `team:${teamThreadId}` : "team:pending",
    type: "direct",
    title: teamThreadName ?? t("messagesInbox.teamMemberTab", "Team Member"),
    subtitle: t(
      "messagesInbox.teamConversationHint",
      "Your direct line to your advisor",
    ),
    preview: teamThreadId
      ? previewFor(
          directById.get(teamThreadId)?.lastMessage ?? null,
          t("messagesInbox.noMessagesYet", "No messages yet"),
          t("chat.attach.only", "Attachment"),
          t("chat.voice.message", "Voice message"),
        )
      : t(
          "messagesInbox.startTeamPreview",
          "Tap to start your conversation",
        ),
    timestamp: teamThreadId
      ? directById.get(teamThreadId)?.lastMessageAt ?? null
      : null,
    unread: teamThreadId ? directById.get(teamThreadId)?.unread ?? 0 : 0,
    otherUserId: teamThreadId
      ? directById.get(teamThreadId)?.otherUserId ?? null
      : null,
  };

  const secondaryConversations: ThreadListItem[] = [];
  if (caseId) {
    secondaryConversations.push({
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
    secondaryConversations.push({
      id: `payout:${payoutThreadId}`,
      type: "direct",
      title: t("messagesInbox.payoutTab", "Payout"),
      subtitle: t(
        "messagesInbox.payoutConversationHint",
        "Your payout conversation",
      ),
      preview: previewFor(
        thread?.lastMessage ?? null,
        t("messagesInbox.noMessagesYet", "No messages yet"),
        t("chat.attach.only", "Attachment"),
        t("chat.voice.message", "Voice message"),
      ),
      timestamp: thread?.lastMessageAt ?? null,
      unread: thread?.unread ?? 0,
    });
  }

  const openFromItem = (item: ThreadListItem) => {
    const [tab, id] = item.id.split(":") as [Tab, string];
    if (tab === "team" && id === "pending") {
      void openTeamThread();
      return;
    }
    setOpen({ tab, id, title: item.title });
  };

  /** Back arrow: leave the chat box and return to the conversation list.
   *  Re-reads the threads so unread badges and previews reflect what was just
   *  read (or received) while the chat was open. */
  const backToList = () => {
    setOpen(null);
    void loadDirectThreads();
  };

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
                <ThreadList
                    items={[teamThread]}
                    selectedId={null}
                    onSelect={openFromItem}
                    emptyLabel={t("messagesInbox.empty")}
                  />

                  <section className="border-t border-border/70">
                    <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("messagesInbox.emergency.title", "Emergency services")}
                      </h2>
                    </div>
                    <div className="divide-y">
                      {EMERGENCY_NUMBERS.map(({ key, number, icon: Icon }) => (
                        <a
                          key={key}
                          href={`tel:${number}`}
                          className="flex w-full items-center gap-3 px-3 py-3 text-start transition-colors hover:bg-muted/60"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {t(
                                `messagesInbox.emergency.${key}`,
                                key === "police"
                                  ? "Police"
                                  : key === "ambulance"
                                    ? "Ambulance"
                                    : "Fire Fighter",
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t(
                                "messagesInbox.emergency.call",
                                "Call {{number}}",
                                { number },
                              )}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-primary">
                            {t("messagesInbox.emergency.action", "Call")}
                          </span>
                        </a>
                      ))}
                    </div>
                  </section>

                  {secondaryConversations.length > 0 && (
                    <ThreadList
                      items={secondaryConversations}
                      selectedId={null}
                      onSelect={openFromItem}
                      emptyLabel={t("messagesInbox.empty")}
                    />
                  )}

                  {teamThreadLoading && (
                    <div className="flex items-center justify-center border-t p-3 text-xs text-muted-foreground">
                      <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />
                      {t("messagesInbox.startingTeamChat", "Opening your team chat…")}
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
