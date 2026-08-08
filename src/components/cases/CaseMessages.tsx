import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import MessageList from "@/components/messages/MessageList";
import MessageComposer from "@/components/messages/MessageComposer";
import {
  fulfilDocumentRequest,
  listCaseMessages,
  markCaseMessagesRead,
  sendCaseMessage,
  toChatMessage,
} from "@/services/CaseMessageService";
import { uploadChatAttachment } from "@/services/ChatAttachmentService";
import { validateAttachmentFile, type ChatMessage } from "@/lib/chatFormat";
import { supabase } from "@/integrations/supabase/client";

interface CaseMessagesProps {
  caseId: string;
  /** Staff can toggle internal notes and request documents; students cannot. */
  allowInternal?: boolean;
  className?: string;
}

export default function CaseMessages({ caseId, allowInternal = false, className }: CaseMessagesProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const fulfilRef = useRef<HTMLInputElement>(null);
  const [fulfilTarget, setFulfilTarget] = useState<ChatMessage | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listCaseMessages(caseId);
      setMessages(rows.map(toChatMessage));
      await markCaseMessagesRead(caseId).catch(() => undefined);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [caseId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`case-messages-${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_messages", filter: `case_id=eq.${caseId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId, load]);

  const handleFulfilFile = async (file: File) => {
    if (!fulfilTarget) return;
    const invalid = validateAttachmentFile(file);
    if (invalid) {
      toast({ variant: "destructive", description: t(`chat.attach.error.${invalid}`) });
      return;
    }
    try {
      const att = await uploadChatAttachment("case", caseId, file);
      await fulfilDocumentRequest(fulfilTarget.id, att);
      toast({ description: t("chat.request.fulfilled") });
      await load();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setFulfilTarget(null);
      if (fulfilRef.current) fulfilRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <div className="max-h-[460px] overflow-y-auto bg-muted/20">
        <MessageList
          messages={messages}
          currentUserId={user?.id ?? null}
          loading={loading}
          emptyLabel={t("case.messages.empty")}
          canFulfilRequests
          onlineUserIds={online}
          onFulfilRequest={(m) => {
            setFulfilTarget(m);
            fulfilRef.current?.click();
          }}
        />
      </div>

      <input
        ref={fulfilRef}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFulfilFile(e.target.files[0])}
      />

      <MessageComposer
        threadType="case"
        threadId={caseId}
        allowInternal={allowInternal}
        allowRequests={allowInternal}
        onSend={async (body, attachments, opts) => {
          await sendCaseMessage(caseId, body, opts.visibility, attachments, opts.kind);
          if (opts.visibility !== "internal") {
            void notifyNewMessageEmail({ threadType: "case", threadId: caseId, preview: body });
          }
          await load();
        }}
      />
    </div>
  );
}

