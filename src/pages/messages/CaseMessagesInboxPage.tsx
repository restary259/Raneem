import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import CaseMessages from "@/components/cases/CaseMessages";
import { listMyCaseThreads, type CaseMessageThread } from "@/services/CaseMessageService";

export default function CaseMessagesInboxPage() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith("/admin") ? "/admin" : "/team";

  const [threads, setThreads] = useState<CaseMessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const rows = await listMyCaseThreads(user.id);
      setThreads(rows);
      setSelected((current) => current ?? rows[0]?.caseId ?? null);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("case-messages-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "case_messages" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (thread) =>
        thread.caseName.toLowerCase().includes(q) ||
        (thread.caseReference ?? "").toLowerCase().includes(q) ||
        thread.lastMessage.body.toLowerCase().includes(q),
    );
  }, [threads, query]);

  const totalUnread = threads.reduce((sum, thread) => sum + thread.unread, 0);
  const active = threads.find((thread) => thread.caseId === selected) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("messagesInbox.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("messagesInbox.subtitle")}</p>
        </div>
        {totalUnread > 0 && (
          <Badge variant="destructive">{t("messagesInbox.unreadTotal", { count: totalUnread })}</Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardContent className="space-y-2 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-muted-foreground ltr:left-2 rtl:right-2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("messagesInbox.searchPlaceholder")}
                className="ltr:pl-8 rtl:pr-8"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("messagesInbox.empty")}
              </p>
            ) : (
              <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
                {filtered.map((thread) => (
                  <li key={thread.caseId}>
                    <button
                      type="button"
                      onClick={() => setSelected(thread.caseId)}
                      className={cn(
                        "w-full rounded-md p-2 text-start transition-colors hover:bg-muted",
                        selected === thread.caseId && "bg-muted",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{thread.caseName}</span>
                        {thread.unread > 0 && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                            {thread.unread}
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {thread.lastMessage.body}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {thread.caseReference ? `${thread.caseReference} · ` : ""}
                        {new Date(thread.lastMessage.created_at).toLocaleString("en-US")}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            {active ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{active.caseName}</p>
                    {active.caseReference && (
                      <p className="text-xs text-muted-foreground">{active.caseReference}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`${basePath}/cases/${active.caseId}`)}
                  >
                    {t("messagesInbox.openCase")}
                  </Button>
                </div>
                <CaseMessages caseId={active.caseId} allowInternal />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <MessageSquare className="h-6 w-6" />
                <p className="text-sm">{t("messagesInbox.selectThread")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
