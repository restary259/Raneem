import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
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
  const [caseId, setCaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  useChatFullscreen(!!isMobile && !!caseId);

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
