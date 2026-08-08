import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import MessageList from "@/components/messages/MessageList";
import MessageComposer from "@/components/messages/MessageComposer";
import {
  editDirectMessage,
  listDirectMessages,
  markDirectThreadRead,
  sendDirectMessage,
  toChatMessage,
} from "@/services/DirectMessageService";
import { getThreadReadState, type ThreadReadState } from "@/services/CaseMessageService";
import type { ChatMessage, MentionablePerson } from "@/lib/chatFormat";
import { notifyNewMessageEmail } from "@/services/NotificationService";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";

const PAGE_SIZE = 50;

interface DirectMessagesProps {
  threadId: string;
  className?: string;
}

export default function DirectMessages({ threadId, className }: DirectMessagesProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "team_member";
  const caseLinkBase = role === "admin" ? "/admin/cases" : "/team/cases";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [readState, setReadState] = useState<ThreadReadState[]>([]);
  const online = useOnlineUsers();
  const { typing, notifyTyping } = useTypingIndicator("direct", threadId);

  const load = useCallback(
    async (nextLimit = limit) => {
      try {
        const rows = await listDirectMessages(threadId, nextLimit);
        setMessages(rows.map(toChatMessage));
        setHasOlder(rows.length >= nextLimit);
        await markDirectThreadRead(threadId).catch(() => undefined);
        setReadState(await getThreadReadState("direct", threadId).catch(() => []));
      } catch (err: any) {
        toast({ variant: "destructive", description: err.message });
      } finally {
        setLoading(false);
      }
    },
    [threadId, limit, toast],
  );

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`direct-messages-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, load]);

  /** Thread participants double as the mention list. */
  const people: MentionablePerson[] = readState
    .filter((r) => r.user_id !== user?.id && r.full_name)
    .map((r) => ({ id: r.user_id, name: r.full_name! }));

  const loadOlder = async () => {
    setLoadingOlder(true);
    const next = limit + PAGE_SIZE;
    setLimit(next);
    await load(next);
    setLoadingOlder(false);
  };

  return (
    <div className={className}>
      <div className="max-h-[460px] overflow-y-auto bg-muted/20">
        <MessageList
          messages={messages}
          currentUserId={user?.id ?? null}
          loading={loading}
          emptyLabel={t("case.messages.empty")}
          onlineUserIds={online}
          readState={readState}
          mentionables={people}
          caseLinkBase={isStaff ? caseLinkBase : undefined}
          adminAlias={isStaff ? undefined : t("chat.adminLabel")}
          viewerIsAdmin={role === "admin"}
          typing={typing}
          hasOlder={hasOlder}
          loadingOlder={loadingOlder}
          onLoadOlder={loadOlder}
          onEditMessage={async (message, body) => {
            try {
              await editDirectMessage(message.id, body);
              await load();
            } catch (err: any) {
              toast({ variant: "destructive", description: err.message });
            }
          }}
        />
      </div>
      <MessageComposer
        threadType="direct"
        threadId={threadId}
        hint={t("chat.directHint")}
        mentionables={people}
        allowCaseMentions={isStaff}
        onTyping={() => notifyTyping(user?.user_metadata?.full_name ?? "")}
        onRequestPayout={isPartner ? () => openPayout() : undefined}
        onSend={async (body, attachments, opts) => {
          await sendDirectMessage(threadId, body, attachments, opts.mentions);
          void notifyNewMessageEmail({ threadType: "direct", threadId, preview: body });
          await load();
        }}
      />

      <PayoutRequestDialog
        open={payoutOpen}
        preview={preview}
        submitting={submitting}
        onOpenChange={setPayoutOpen}
        onConfirm={submitPayout}
      />
    </div>
  );
}

