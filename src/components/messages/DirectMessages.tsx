import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import MessageList from "@/components/messages/MessageList";
import MessageComposer from "@/components/messages/MessageComposer";
import {
  listDirectMessages,
  markDirectThreadRead,
  sendDirectMessage,
  toChatMessage,
} from "@/services/DirectMessageService";
import type { ChatMessage } from "@/lib/chatFormat";
import { notifyNewMessageEmail } from "@/services/NotificationService";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";

interface DirectMessagesProps {
  threadId: string;
  className?: string;
}

export default function DirectMessages({ threadId, className }: DirectMessagesProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const online = useOnlineUsers();

  const load = useCallback(async () => {
    try {
      const rows = await listDirectMessages(threadId);
      setMessages(rows.map(toChatMessage));
      await markDirectThreadRead(threadId).catch(() => undefined);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [threadId, toast]);

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

  return (
    <div className={className}>
      <div className="max-h-[460px] overflow-y-auto bg-muted/20">
        <MessageList
          messages={messages}
          currentUserId={user?.id ?? null}
          loading={loading}
          emptyLabel={t("case.messages.empty")}
          onlineUserIds={online}
        />
      </div>
      <MessageComposer
        threadType="direct"
        threadId={threadId}
        hint={t("chat.directHint")}
        onSend={async (body, attachments) => {
          await sendDirectMessage(threadId, body, attachments);
          void notifyNewMessageEmail({ threadType: "direct", threadId, preview: body });
          await load();
        }}
      />
    </div>
  );
}
