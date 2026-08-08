import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Lock, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  listCaseMessages,
  markCaseMessagesRead,
  sendCaseMessage,
  type CaseMessage,
  type MessageVisibility,
} from "@/services/CaseMessageService";
import { supabase } from "@/integrations/supabase/client";

interface CaseMessagesProps {
  caseId: string;
  /** Staff can toggle internal notes; students cannot. */
  allowInternal?: boolean;
}

export default function CaseMessages({ caseId, allowInternal = false }: CaseMessagesProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<MessageVisibility>("shared");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listCaseMessages(caseId);
      setMessages(rows);
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
        { event: "INSERT", schema: "public", table: "case_messages", filter: `case_id=eq.${caseId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await sendCaseMessage(caseId, body, allowInternal ? visibility : "shared");
      setBody("");
      await load();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="max-h-[420px] overflow-y-auto space-y-3 pe-1">
        {loading ? (
          <>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("case.messages.empty")}</p>
        ) : (
          messages.map((m) => {
            const mine = m.author_id === user?.id;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg border px-3 py-2 space-y-1",
                    mine ? "bg-primary/10 border-primary/20" : "bg-muted/40",
                    m.visibility === "internal" && "border-amber-300 bg-amber-50",
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">
                      {m.author_name || t(`case.messages.role.${m.author_role}`, m.author_role)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("en-US")}
                    </span>
                    {m.visibility === "internal" && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Lock className="h-3 w-3" />
                        {t("case.messages.internal")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="space-y-2 border-t pt-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("case.messages.placeholder")}
          rows={3}
          maxLength={5000}
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {allowInternal ? (
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={visibility === "shared" ? "default" : "outline"}
                onClick={() => setVisibility("shared")}
                className="gap-1"
              >
                <Users className="h-3.5 w-3.5" />
                {t("case.messages.shared")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={visibility === "internal" ? "default" : "outline"}
                onClick={() => setVisibility("internal")}
                className="gap-1"
              >
                <Lock className="h-3.5 w-3.5" />
                {t("case.messages.internal")}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("case.messages.studentHint")}</p>
          )}
          <Button size="sm" onClick={handleSend} disabled={!body.trim() || sending} className="gap-1">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("case.messages.send")}
          </Button>
        </div>
        {allowInternal && (
          <p className="text-xs text-muted-foreground">
            {visibility === "internal" ? t("case.messages.internalHint") : t("case.messages.sharedHint")}
          </p>
        )}
      </div>
    </div>
  );
}
