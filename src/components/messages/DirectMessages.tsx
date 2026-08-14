import { useCallback, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import MessageList from "@/components/messages/MessageList";
import MessageComposer from "@/components/messages/MessageComposer";
import PayoutRequestDialog from "@/components/messages/PayoutRequestDialog";
import {
  getMyPayoutPreview,
  requestPayoutViaChat,
  type PayoutPreview,
} from "@/services/PayoutRequestService";

import {
  editDirectMessage,
  listDirectMessages,
  markDirectThreadRead,
  sendDirectMessage,
  toChatMessage,
} from "@/services/DirectMessageService";
import {
  deleteChatMessage,
  getThreadReadState,
  type ThreadReadState,
} from "@/services/CaseMessageService";
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
  const isPartner = role === "social_media_partner" || role === "ambassador" || role === "agent";
  const caseLinkBase = role === "admin" ? "/admin/cases" : "/team/cases";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [readState, setReadState] = useState<ThreadReadState[]>([]);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [preview, setPreview] = useState<PayoutPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

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
        () => loadRef.current(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

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

  const openPayout = async () => {
    setPreview(null);
    setPayoutOpen(true);
    try {
      setPreview(await getMyPayoutPreview());
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
      setPayoutOpen(false);
    }
  };

  const submitPayout = async () => {
    setSubmitting(true);
    try {
      const res = await requestPayoutViaChat();
      setPayoutOpen(false);
      // The payout card is posted server-side, so the composer's email hook never
      // fires — notify the admin thread explicitly.
      void notifyNewMessageEmail({
        threadType: "direct",
        threadId: res?.thread_id ?? threadId,
        preview: t("chat.payout.emailPreview", "New payout request"),
      });
      toast({ description: t("chat.payout.sent") });
      await load();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/20">

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
          onDeleteMessage={async (message) => {
            try {
              await deleteChatMessage(message.id, "direct");
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

