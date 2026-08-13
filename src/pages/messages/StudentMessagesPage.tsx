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
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatFullscreen } from "@/components/messages/chatFullscreen";

/** The student's single conversation with their advisor. */
export default function StudentMessagesPage() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [caseId, setCaseId] = useState<string | null>(null);
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
      setLoading(false);
    })();
  }, [user?.id, toast]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-2 p-2 md:static md:h-[calc(100vh-8rem)] md:min-h-[520px] md:gap-4 md:p-6",
        caseId
          ? "max-md:fixed max-md:inset-0 max-md:z-50 max-md:h-[100dvh] max-md:bg-background"
          : "h-[calc(100dvh-7.5rem)]",
      )}
    >
      <div>
        <h1 className="text-xl font-semibold">{t("messagesInbox.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("messagesInbox.studentSubtitle")}</p>
      </div>

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
        ) : caseId ? (
          <CaseMessages caseId={caseId} className="flex min-h-0 flex-1 flex-col" />
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
