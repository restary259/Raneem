import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, MessageSquare, Plus, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import CaseMessages from "@/components/cases/CaseMessages";
import DirectMessages from "@/components/messages/DirectMessages";
import { listMyCaseThreads, type CaseMessageThread } from "@/services/CaseMessageService";
import {
  listMyDirectThreads,
  listStaffDirectory,
  startDirectThread,
  type DirectThread,
  type StaffMember,
} from "@/services/DirectMessageService";

export default function CaseMessagesInboxPage() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith("/admin") ? "/admin" : "/team";

  const [threads, setThreads] = useState<CaseMessageThread[]>([]);
  const [directThreads, setDirectThreads] = useState<DirectThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedDirect, setSelectedDirect] = useState<string | null>(null);
  const [tab, setTab] = useState<"cases" | "direct">("cases");

  const [staffOpen, setStaffOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [caseRows, directRows] = await Promise.all([
        listMyCaseThreads(user.id),
        listMyDirectThreads(user.id).catch(() => [] as DirectThread[]),
      ]);
      setThreads(caseRows);
      setDirectThreads(directRows);
      setSelected((current) => current ?? caseRows[0]?.caseId ?? null);
      setSelectedDirect((current) => current ?? directRows[0]?.threadId ?? null);
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
      .channel("messages-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "case_messages" }, () =>
        load(),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () =>
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

  const filteredDirect = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return directThreads;
    return directThreads.filter(
      (thread) =>
        thread.otherUserName.toLowerCase().includes(q) ||
        (thread.lastMessage?.body ?? "").toLowerCase().includes(q),
    );
  }, [directThreads, query]);

  const caseUnread = threads.reduce((sum, thread) => sum + thread.unread, 0);
  const directUnread = directThreads.reduce((sum, thread) => sum + thread.unread, 0);
  const totalUnread = caseUnread + directUnread;
  const active = threads.find((thread) => thread.caseId === selected) ?? null;
  const activeDirect = directThreads.find((thread) => thread.threadId === selectedDirect) ?? null;

  const openStaffPicker = async () => {
    setStaffOpen(true);
    if (staff.length > 0) return;
    setStaffLoading(true);
    try {
      const rows = await listStaffDirectory();
      setStaff(rows.filter((s) => s.id !== user?.id));
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setStaffLoading(false);
    }
  };

  const openDirectWith = async (staffId: string) => {
    try {
      const threadId = await startDirectThread(staffId);
      setStaffOpen(false);
      setTab("direct");
      setSelectedDirect(threadId);
      await load();
    } catch (err: any) {
      const blocked = /must include an admin|not staff|Only staff/i.test(err.message ?? "");
      toast({
        variant: "destructive",
        description: blocked ? t("messagesInbox.directBlocked") : err.message,
      });
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("messagesInbox.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("messagesInbox.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <Badge variant="destructive">
              {t("messagesInbox.unreadTotal", { count: totalUnread })}
            </Badge>
          )}
          <Dialog open={staffOpen} onOpenChange={setStaffOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={openStaffPicker}>
                <Plus className="h-4 w-4" />
                {t("messagesInbox.newDirect")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("messagesInbox.pickStaff")}</DialogTitle>
              </DialogHeader>
              {staffLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : staff.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("messagesInbox.noStaff")}
                </p>
              ) : (
                <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
                  {staff.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => openDirectWith(member.id)}
                        className="flex w-full items-center justify-between rounded-md p-2 text-start transition-colors hover:bg-muted"
                      >
                        <span className="text-sm font-medium">{member.full_name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {t(`case.messages.role.${member.role}`, member.role)}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">{t("messagesInbox.directHint")}</p>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "cases" | "direct")}>
        <TabsList>
          <TabsTrigger value="cases" className="gap-2">
            {t("messagesInbox.tabCases")}
            {caseUnread > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {caseUnread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="direct" className="gap-2">
            {t("messagesInbox.tabDirect")}
            {directUnread > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {directUnread}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="relative mt-4 max-w-sm">
          <Search className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-muted-foreground ltr:left-2 rtl:right-2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("messagesInbox.searchPlaceholder")}
            className="ltr:pl-8 rtl:pr-8"
          />
        </div>

        <TabsContent value="cases" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card className="h-fit">
              <CardContent className="space-y-2 p-3">
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
        </TabsContent>

        <TabsContent value="direct" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card className="h-fit">
              <CardContent className="space-y-2 p-3">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredDirect.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("messagesInbox.emptyDirect")}
                  </p>
                ) : (
                  <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
                    {filteredDirect.map((thread) => (
                      <li key={thread.threadId}>
                        <button
                          type="button"
                          onClick={() => setSelectedDirect(thread.threadId)}
                          className={cn(
                            "w-full rounded-md p-2 text-start transition-colors hover:bg-muted",
                            selectedDirect === thread.threadId && "bg-muted",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">
                              {thread.otherUserName}
                            </span>
                            {thread.unread > 0 && (
                              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                {thread.unread}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {thread.lastMessage?.body ?? t("messagesInbox.noMessagesYet")}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {thread.otherUserRole
                              ? `${t(`case.messages.role.${thread.otherUserRole}`, thread.otherUserRole)} · `
                              : ""}
                            {new Date(thread.lastMessageAt).toLocaleString("en-US")}
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
                {activeDirect ? (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium">{activeDirect.otherUserName}</p>
                      {activeDirect.otherUserRole && (
                        <p className="text-xs text-muted-foreground">
                          {t(
                            `case.messages.role.${activeDirect.otherUserRole}`,
                            activeDirect.otherUserRole,
                          )}
                        </p>
                      )}
                    </div>
                    <DirectMessages threadId={activeDirect.threadId} />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
