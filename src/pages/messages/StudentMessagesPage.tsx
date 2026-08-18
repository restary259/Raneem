import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Loader2, MessageSquare, UserCheck } from "lucide-react";
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

type Tab = "case" | "payout" | "team";

export default function StudentMessagesPage() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [payoutThreadId, setPayoutThreadId] = useState<string | null>(null);
  const [teamThreadId, setTeamThreadId] = useState<string | null>(null);
  const [teamThreadLoading, setTeamThreadLoading] = useState(false);
  const [active, setActive] = useState<Tab>("case");
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  useChatFullscreen(!!isMobile && (!!caseId || !!payoutThreadId || !!teamThreadId));

  const isRtl = document.documentElement.dir === "rtl";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

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

      setLoading(false);
    })();
  }, [user?.id, toast]);

  /** Opens (or reuses) the student↔team-member thread. */
  const openTeamThread = async () => {
    if (teamThreadId) {
      setActive("team");
      return;
    }
    setTeamThreadLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("start_student_team_member_thread");
      if (error) throw error;
      setTeamThreadId(data as string);
      setActive("team");
    } catch (err: any) {
      const noCase = /No completed case/i.test(err.message ?? "");
      toast({
        variant: "destructive",
        description: noCase
          ? t("messagesInbox.teamThreadNoCase", "Chat with your team member is available once your case is completed.")
          : err.message,
      });
    } finally {
      setTeamThreadLoading(false);
    }
  };

  const hasTabs = !!(caseId || payoutThreadId);
  const showCase = active === "case" && !!caseId;
  const showPayout = active === "payout" && !!payoutThreadId;
  const showTeam = active === "team" && !!teamThreadId;
  const fallbackPayout = !caseId && !!payoutThreadId;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-2 p-2 md:static md:h-[calc(100vh-8rem)] md:min-h-[520px] md:gap-4 md:p-6",
        caseId || payoutThreadId || teamThreadId
          ? "max-md:fixed max-md:inset-0 max-md:z-50 max-md:h-[100dvh] max-md:bg-background"
          : "h-[calc(100dvh-7.5rem)]",
      )}
    >
      <div>
        <h1 className="text-xl font-semibold">{t("messagesInbox.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("messagesInbox.studentSubtitle")}</p>
      </div>

      {hasTabs && (
        <div className="flex flex-wrap items-center gap-1" role="tablist">
          {caseId && (
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
          )}
          {payoutThreadId && (
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
          )}
          {/* Team member tab — shows once opened, or as a button to initiate */}
          <Button
            variant={active === "team" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-full gap-1.5"
            role="tab"
            aria-selected={active === "team"}
            onClick={openTeamThread}
            disabled={teamThreadLoading}
          >
            {teamThreadLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserCheck className="h-3.5 w-3.5" />
            )}
            {t("messagesInbox.teamMemberTab", "Team Member")}
          </Button>
        </div>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : showCase ? (
          <CaseMessages caseId={caseId!} className="flex-1 overflow-hidden" />
        ) : showPayout ? (
          <DirectMessages threadId={payoutThreadId!} className="flex-1 overflow-hidden" />
        ) : showTeam ? (
          <DirectMessages threadId={teamThreadId!} className="flex-1 overflow-hidden" />
        ) : fallbackPayout ? (
          <DirectMessages threadId={payoutThreadId!} className="flex-1 overflow-hidden" />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center p-6">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t("messagesInbox.noConversationYet")}</p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={openTeamThread}
              disabled={teamThreadLoading}
            >
              {teamThreadLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
              {t("messagesInbox.contactTeamMember", "Contact My Team Member")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
