import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Loader2, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CaseMessages from "@/components/cases/CaseMessages";
import DirectMessages from "@/components/messages/DirectMessages";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatFullscreen } from "@/components/messages/chatFullscreen";

/**
 * The student's conversation hub. Primary conversation: their advisor case
 * thread (case_messages). When the student has requested a payout, the direct
 * thread created by request_payout_via_chat (direct_messages) is also
 * available, switched with the Case/Payout tabs. The tabs only appear once a
 * payout thread exists; a referring student can have a payout thread with no
 * own case, in which case the payout conversation is shown directly.
 */
export default function StudentMessagesPage() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [payoutThreadId, setPayoutThreadId] = useState<string | null>(null);
  const [active, setActive] = useState<"case" | "payout">("case");
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  useChatFullscreen(!!isMobile && !!caseId);

  // RTL-aware back arrow, mirroring the pattern used by CaseMessagesInboxPage.
  const isRtl = document.documentElement.dir === "rtl";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      // Restricted accessor: returns the student's own case without internal
      // commission/revenue columns.
      const { data, error } = await (supabase as any).rpc("get_my_case");
      if (error) toast({ variant: "destructive", description: error.message });
      setCaseId(data?.[0]?.id ?? null);

      // RLS scopes payout_requests to the student's own rows, so this only
      // ever returns their payout direct thread (created by
      // request_payout_via_chat).
      const { data: payouts } = await (supabase as any)
        .from("payout_requests")
        .select("thread_id")
        .not("thread_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      setPayoutThreadId(payouts?.[0]?.thread_id ?? null);
      setLoading(false);
    })();
  }, [user?.id, toast]);

  const showTabs = !!caseId && !!payoutThreadId;
  const showPayout = active === "payout" && !!payoutThreadId;
  const showCase = active === "case" && !!caseId;
  const fallbackPayout = !caseId && !!payoutThreadId;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-2 p-2 md:static md:h-[calc(100vh-8rem)] md:min-h-[520px] md:gap-4 md:p-6",
        caseId || payoutThreadId
          ? "max-md:fixed max-md:inset-0 max-md:z-50 max-md:h-[100dvh] max-md:bg-background"
          : "h-[calc(100dvh-7.5rem)]",
      )}
    >
      <div>
        <h1 className="text-xl font-semibold">{t("messagesInbox.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("messagesInbox.studentSubtitle")}</p>
      </div>

      {showTabs && (
        <div className="flex items-center gap-1" role="tablist" aria-label={t("messagesInbox.title")}>
          <Button
            variant={active === "case" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-full"
            role="tab"
            aria-selected={active === "case"}
            onClick={() => setActive("case")}
          >
            {t("messagesInbox.caseTab")}
          </Button>
          <Button
            variant={active === "payout" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-full"
            role="tab"
            aria-selected={active === "payout"}
            onClick={() => setActive("payout")}
          >
            {t("messagesInbox.payoutTab")}
          </Button>
        </div>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Mobile-only back header. The full-screen overlay hides the
            MobileBottomNav (useChatFullscreen), and unlike the team/partner
            inbox pages this single-conversation view has no thread list to
            return to — so the back arrow navigates to the student dashboard,
            which unmounts the page and restores the bottom nav. Desktop keeps
            its sidebar/header for navigation, so this bar is md:hidden. */}
        {caseId && (
          <div className="flex items-center gap-2 border-b p-2 md:hidden">
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0"
              aria-label={t("chat.back")}
              onClick={() => navigate("/student")}
            >
              <BackIcon className="h-4 w-4" />
            </Button>
            <p className="truncate font-medium">{t("messagesInbox.title")}</p>
          </div>
        )}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : showPayout || fallbackPayout ? (
          <DirectMessages
            key={payoutThreadId ?? undefined}
            threadId={payoutThreadId as string}
            className="flex min-h-0 flex-1 flex-col"
          />
        ) : showCase ? (
          <CaseMessages key={caseId} caseId={caseId} className="flex min-h-0 flex-1 flex-col" />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("messagesInbox.noCaseYet")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
