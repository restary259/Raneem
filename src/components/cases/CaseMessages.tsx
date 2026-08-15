import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import MessageList from "@/components/messages/MessageList";
import MessageComposer from "@/components/messages/MessageComposer";
import PayoutRequestDialog from "@/components/messages/PayoutRequestDialog";
import {
  clearCaseThread,
  deleteChatMessage,
  editCaseMessage,
  fulfilDocumentRequest,
  getThreadReadState,
  listCaseMessages,
  markCaseMessagesRead,
  sendCaseMessage,
  toChatMessage,
  type ThreadReadState,
} from "@/services/CaseMessageService";
import { listStaffDirectory } from "@/services/DirectMessageService";
import { uploadChatAttachment } from "@/services/ChatAttachmentService";
import {
  validateAttachmentFile,
  type ChatMessage,
  type MentionablePerson,
} from "@/lib/chatFormat";
import { supabase } from "@/integrations/supabase/client";
import { notifyNewMessageEmail } from "@/services/NotificationService";
import {
  getMyPayoutPreview,
  requestPayoutViaChat,
  type PayoutPreview,
} from "@/services/PayoutRequestService";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";

const PAGE_SIZE = 50;

interface CaseMessagesProps {
  caseId: string;
  /** Staff can toggle internal notes and request documents; students cannot. */
  allowInternal?: boolean;
  className?: string;
}

export default function CaseMessages({ caseId, allowInternal = false, className }: CaseMessagesProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "team_member";
  const caseLinkBase = role === "admin" ? "/admin/cases" : "/team/cases";
  const isStudent = role === "student";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [readState, setReadState] = useState<ThreadReadState[]>([]);
  const [people, setPeople] = useState<MentionablePerson[]>([]);
  const fulfilRef = useRef<HTMLInputElement>(null);
  const [fulfilTarget, setFulfilTarget] = useState<ChatMessage | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutPreview, setPayoutPreview] = useState<PayoutPreview | null>(null);
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const online = useOnlineUsers();
  const { typing, notifyTyping } = useTypingIndicator("case", caseId);

  const load = useCallback(
    async (nextLimit = limit) => {
      try {
        const rows = await listCaseMessages(caseId, nextLimit);
        setMessages(rows.map(toChatMessage));
        setHasOlder(rows.length >= nextLimit);
        await markCaseMessagesRead(caseId).catch(() => undefined);
        setReadState(await getThreadReadState("case", caseId).catch(() => []));
      } catch (err: any) {
        toast({ variant: "destructive", description: err.message });
      } finally {
        setLoading(false);
      }
    },
    [caseId, limit, toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!allowInternal) return;
    listStaffDirectory()
      .then((rows) =>
        setPeople(rows.map((s) => ({ id: s.id, name: s.full_name, role: s.role }))),
      )
      .catch(() => setPeople([]));
  }, [allowInternal]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const channel = supabase
      .channel(`case-messages-${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_messages", filter: `case_id=eq.${caseId}` },
        () => loadRef.current(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId]);

  const loadOlder = async () => {
    setLoadingOlder(true);
    const next = limit + PAGE_SIZE;
    setLimit(next);
    await load(next);
    setLoadingOlder(false);
  };

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

  const handleClearThread = async () => {
    if (!window.confirm(t("chat.clearThread.confirm", "Delete all messages in this case thread?"))) return;
    try {
      const n = await clearCaseThread(caseId);
      toast({ description: t("chat.clearThread.done", { count: n, defaultValue: "{{count}} messages deleted" }) });
      await load();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const openPayout = async () => {
    setPayoutPreview(null);
    setPayoutOpen(true);
    try {
      setPayoutPreview(await getMyPayoutPreview());
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
      setPayoutOpen(false);
    }
  };

  const submitPayout = async () => {
    setPayoutSubmitting(true);
    try {
      const res = await requestPayoutViaChat();
      setPayoutOpen(false);
      // The payout card is posted server-side to the admin direct thread, so
      // the composer's email hook never fires — notify the thread explicitly.
      if (res?.thread_id) {
        void notifyNewMessageEmail({
          threadType: "direct",
          threadId: res.thread_id,
          preview: t("chat.payout.emailPreview", "New payout request"),
        });
      }
      toast({ description: t("chat.payout.sent") });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setPayoutSubmitting(false);
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {role === "admin" && messages.length > 0 && (
        <div className="flex shrink-0 justify-end border-b bg-background px-3 py-1.5">
          <button
            type="button"
            onClick={handleClearThread}
            className="text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            {t("chat.clearThread.button", "Clear thread")}
          </button>
        </div>
      )}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/20",
          !className && "max-h-[460px]",
        )}
      >

        <MessageList
          messages={messages}
          currentUserId={user?.id ?? null}
          loading={loading}
          emptyLabel={t("case.messages.empty")}
          canFulfilRequests
          onlineUserIds={online}
          readState={readState}
          mentionables={people}
          caseLinkBase={isStaff ? caseLinkBase : undefined}
          viewerIsAdmin={role === "admin"}
          typing={typing}
          hasOlder={hasOlder}
          loadingOlder={loadingOlder}
          onLoadOlder={loadOlder}
          onEditMessage={async (message, body) => {
            try {
              await editCaseMessage(message.id, body);
              await load();
            } catch (err: any) {
              toast({ variant: "destructive", description: err.message });
            }
          }}
          onDeleteMessage={async (message) => {
            try {
              await deleteChatMessage(message.id, "case");
              await load();
            } catch (err: any) {
              toast({ variant: "destructive", description: err.message });
            }
          }}
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
        mentionables={people}
        allowCaseMentions={isStaff}
        onRequestPayout={isStudent ? () => openPayout() : undefined}
        onTyping={() => notifyTyping(user?.user_metadata?.full_name ?? "")}
        onSend={async (body, attachments, opts) => {
          await sendCaseMessage(
            caseId,
            body,
            opts.visibility,
            attachments,
            opts.kind,
            opts.mentions,
          );
          if (opts.visibility !== "internal") {
            void notifyNewMessageEmail({ threadType: "case", threadId: caseId, preview: body });
          }
          await load();
        }}
      />

      <PayoutRequestDialog
        open={payoutOpen}
        preview={payoutPreview}
        submitting={payoutSubmitting}
        onOpenChange={setPayoutOpen}
        onConfirm={submitPayout}
      />
    </div>
  );
}
