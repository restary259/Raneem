import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, BellOff, Loader2, MessageSquare, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import ThreadList, { type ThreadListItem } from "@/components/messages/ThreadList";
import {
  listMutedThreads,
  listMyCaseThreads,
  setThreadMuted,
  type CaseMessageThread,
} from "@/services/CaseMessageService";
import {
  listMyDirectThreads,
  listStaffDirectory,
  startDirectThread,
  type DirectThread,
  type StaffMember,
} from "@/services/DirectMessageService";

type Filter = "all" | "cases" | "direct" | "unread";

export default function CaseMessagesInboxPage() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith("/admin") ? "/admin" : "/team";

  const [threads, setThreads] = useState<CaseMessageThread[]>([]);
  const [directThreads, setDirectThreads] = useState<DirectThread[]>([]);
  const [muted, setMuted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<{ type: "case" | "direct"; id: string } | null>(null);

  const [staffOpen, setStaffOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [caseRows, directRows, muteRows] = await Promise.all([
        listMyCaseThreads(user.id),
        listMyDirectThreads(user.id).catch(() => [] as DirectThread[]),
        listMutedThreads(user.id).catch(() => []),
      ]);
      setThreads(caseRows);
      setDirectThreads(directRows);
      setMuted(new Set(muteRows.map((m) => `${m.thread_type}:${m.thread_id}`)));
      setSelected((current) => {
        if (current) return current;
        if (caseRows[0]) return { type: "case", id: caseRows[0].caseId };
        if (directRows[0]) return { type: "direct", id: directRows[0].threadId };
        return null;
      });
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

  const items: ThreadListItem[] = useMemo(() => {
    const caseItems: ThreadListItem[] = threads.map((thread) => ({
      id: thread.caseId,
      type: "case",
      title: thread.caseName,
      subtitle: thread.caseReference,
      preview: thread.lastMessage.body || t("chat.attach.only"),
      timestamp: thread.lastMessage.created_at,
      unread: thread.unread,
    }));
    const directItems: ThreadListItem[] = directThreads.map((thread) => ({
      id: thread.threadId,
      type: "direct",
      title: thread.otherUserName,
      subtitle: thread.otherUserRole
        ? t(`case.messages.role.${thread.otherUserRole}`, thread.otherUserRole)
        : null,
      preview: thread.lastMessage?.body || t("messagesInbox.noMessagesYet"),
      timestamp: thread.lastMessageAt,
      unread: thread.unread,
    }));

    const q = query.trim().toLowerCase();
    return [...caseItems, ...directItems]
      .filter((item) => {
        if (filter === "cases" && item.type !== "case") return false;
        if (filter === "direct" && item.type !== "direct") return false;
        if (filter === "unread" && item.unread === 0) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          (item.subtitle ?? "").toLowerCase().includes(q) ||
          item.preview.toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime(),
      );
  }, [threads, directThreads, query, filter, t]);

  const caseUnread = threads.reduce((sum, thread) => sum + thread.unread, 0);
  const directUnread = directThreads.reduce((sum, thread) => sum + thread.unread, 0);
  const totalUnread = caseUnread + directUnread;

  const activeCase =
    selected?.type === "case" ? threads.find((x) => x.caseId === selected.id) ?? null : null;
  const activeDirect =
    selected?.type === "direct"
      ? directThreads.find((x) => x.threadId === selected.id) ?? null
      : null;

  const isMuted = selected ? muted.has(`${selected.type}:${selected.id}`) : false;

  const toggleMute = async () => {
    if (!selected || !user?.id) return;
    try {
      await setThreadMuted(user.id, selected.type, selected.id, !isMuted);
      setMuted((prev) => {
        const next = new Set(prev);
        const key = `${selected.type}:${selected.id}`;
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

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
      setFilter("all");
      setSelected({ type: "direct", id: threadId });
      await load();
    } catch (err: any) {
      const blocked = /must include an admin|not staff|Only staff/i.test(err.message ?? "");
      toast({
        variant: "destructive",
        description: blocked ? t("messagesInbox.directBlocked") : err.message,
      });
    }
  };

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: t("chat.filter.all") },
    { key: "cases", label: t("chat.filter.cases"), count: caseUnread },
    { key: "direct", label: t("chat.filter.direct"), count: directUnread },
    { key: "unread", label: t("chat.filter.unread"), count: totalUnread },
  ];

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[520px] flex-col gap-4 p-4 md:p-6">
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

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="space-y-2 border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-muted-foreground ltr:left-2 rtl:right-2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("messagesInbox.searchPlaceholder")}
                className="ltr:pl-8 rtl:pr-8"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    filter === f.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
                >
                  {f.label}
                  {f.count ? ` (${f.count})` : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ThreadList
                items={items}
                selectedId={selected?.id ?? null}
                onSelect={(item) => setSelected({ type: item.type, id: item.id })}
                emptyLabel={t("messagesInbox.empty")}
              />
            )}
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden">
          {activeCase || activeDirect ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {activeCase ? activeCase.caseName : activeDirect!.otherUserName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {activeCase
                      ? activeCase.caseReference ?? t("chat.type.case")
                      : activeDirect!.otherUserRole
                        ? t(
                            `case.messages.role.${activeDirect!.otherUserRole}`,
                            activeDirect!.otherUserRole,
                          )
                        : t("chat.type.direct")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={toggleMute}>
                    {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    {isMuted ? t("chat.unmute") : t("chat.mute")}
                  </Button>
                  {activeCase && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`${basePath}/cases/${activeCase.caseId}`)}
                    >
                      {t("messagesInbox.openCase")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                {activeCase ? (
                  <CaseMessages
                    key={activeCase.caseId}
                    caseId={activeCase.caseId}
                    allowInternal
                    className="flex min-h-0 flex-1 flex-col [&>div:first-child]:max-h-none [&>div:first-child]:flex-1"
                  />
                ) : (
                  <DirectMessages
                    key={activeDirect!.threadId}
                    threadId={activeDirect!.threadId}
                    className="flex min-h-0 flex-1 flex-col [&>div:first-child]:max-h-none [&>div:first-child]:flex-1"
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageSquare className="h-6 w-6" />
              <p className="text-sm">{t("messagesInbox.selectThread")}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
