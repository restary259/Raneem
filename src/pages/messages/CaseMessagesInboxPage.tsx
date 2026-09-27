import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "@/lib/router-compat";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  FolderOpen,
  Loader2,
  MessageCircle,

  MessageSquare,
  Plus,
  Search,
  Send,
  Settings2,
  Users,

} from "lucide-react";
import { toneClasses } from "@/lib/statusTokens";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useInternalTeamChatAccess } from "@/hooks/useInternalTeamChatAccess";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatFullscreen } from "@/components/messages/chatFullscreen";
import CaseMessages from "@/components/cases/CaseMessages";
import DirectMessages from "@/components/messages/DirectMessages";
import ThreadList, { type ThreadListItem } from "@/components/messages/ThreadList";
import StaffPickerDialog from "@/components/messages/StaffPickerDialog";
import {
  listMutedThreads,
  listMyCaseThreads,
  setThreadMuted,
  type CaseMessageThread,
} from "@/services/CaseMessageService";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { getRoleLabel } from "@/lib/roleLabels";
import {
  getNotificationPrefs,
  sendTestNotificationEmail,
  updateNotificationPrefs,
  type NotificationPrefs,
} from "@/services/NotificationService";

import {
  listMyDirectThreads,
  startDirectThread,
  startTeamChatThread,
  type DirectThread,
} from "@/services/DirectMessageService";

const FS_CHAT =
  "max-md:fixed max-md:inset-0 max-md:z-50 max-md:h-[100dvh] max-md:rounded-none max-md:border-0 max-md:shadow-none";

type Filter = "all" | "direct" | "teams" | "unread";

export default function CaseMessagesInboxPage() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user, role } = useAuth();
  const { canAccess: canStartTeamChat, loading: teamChatAccessLoading } = useInternalTeamChatAccess();
  const isAdmin = role === "admin";
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
  const [teamStaffOpen, setTeamStaffOpen] = useState(false);
  const online = useOnlineUsers();
  const isMobile = useIsMobile();
  const [prefs, setPrefs] = useState<NotificationPrefs>({ notify_in_app: true, notify_email: true });
  useChatFullscreen(!!isMobile && !!selected);
  const isRtl = document.documentElement.dir === "rtl";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (!user?.id) return;
    getNotificationPrefs(user.id).then(setPrefs).catch(() => undefined);
  }, [user?.id]);

  const savePrefs = async (next: Partial<NotificationPrefs>) => {
    if (!user?.id) return;
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    try {
      await updateNotificationPrefs(user.id, next);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const [testingEmail, setTestingEmail] = useState(false);
  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const to = await sendTestNotificationEmail();
      toast({ description: t("chat.notify.testEmailSent", { email: to }) });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setTestingEmail(false);
    }
  };


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
      // Do NOT auto-select the first thread on load — the inbox opens on the
      // conversation list and the user explicitly picks one to open it.
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
      .on("postgres_changes", { event: "*", schema: "public", table: "case_messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const items: ThreadListItem[] = useMemo(() => {
    const caseItems: ThreadListItem[] = threads.map((thread) => ({
      id: thread.caseId,
      type: "case",
      category: "cases" as const,
      title: thread.caseName,
      subtitle: thread.caseReference,
      preview: thread.lastMessage.body || t("chat.attach.only"),
      timestamp: thread.lastMessage.created_at,
      unread: thread.unread,
    }));
    const isTeamRole = (r?: string | null) => r === "team_member";
    const directItems: ThreadListItem[] = directThreads
      // If team chat is disabled for this user, do not show peer team members at all
      .filter((thread) => (canStartTeamChat ? true : !isTeamRole(thread.otherUserRole)))
      .map((thread) => ({
        id: thread.threadId,
        type: "direct",
        category: isTeamRole(thread.otherUserRole) ? ("teams" as const) : ("direct" as const),
        title: thread.otherUserName,
        subtitle: thread.otherUserRole
          ? t(`case.messages.role.${thread.otherUserRole}`, thread.otherUserRole)
          : null,
        preview: thread.lastMessage?.body || t("messagesInbox.noMessagesYet"),
        timestamp: thread.lastMessageAt,
        unread: thread.unread,
        otherUserId: thread.otherUserId,
      }));

    const q = query.trim().toLowerCase();
    return [...directItems, ...caseItems]
      .filter((item) => {
        if (filter === "direct" && item.category !== "direct") return false;
        if (filter === "teams" && item.category !== "teams") return false;
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
  }, [threads, directThreads, query, filter, t, canStartTeamChat]);

  const teamThreads = directThreads.filter((t) => t.otherUserRole === "team_member");
  const teamUnread = canStartTeamChat
    ? teamThreads.reduce((sum, t) => sum + t.unread, 0)
    : 0;
  const nonTeamDirectThreads = directThreads.filter((t) => t.otherUserRole !== "team_member");
  const directUnread = nonTeamDirectThreads.reduce((sum, t) => sum + t.unread, 0);
  const caseUnread = threads.reduce((sum, thread) => sum + thread.unread, 0);
  const totalUnread = directUnread + teamUnread + caseUnread;

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

  const openTeamChatWith = async (staffId: string) => {
    try {
      const threadId = await startTeamChatThread(staffId);
      setTeamStaffOpen(false);
      setFilter("all");
      setSelected({ type: "direct", id: threadId });
      await load();
    } catch (err: any) {
      toast({
        variant: "destructive",
        description: /team chat|team member|enabled/i.test(err.message ?? "")
          ? t("messagesInbox.teamChatBlocked", "Internal team chat is not enabled for this account.")
          : err.message,
      });
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
    { key: "direct", label: t("chat.section.direct"), count: directUnread },
    ...(canStartTeamChat
      ? [{ key: "teams" as const, label: t("chat.filter.teams", "Teams"), count: teamUnread }]
      : []),
    { key: "unread", label: t("chat.filter.unread"), count: totalUnread },
  ];

  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-7.5rem)] min-h-0 flex-col md:h-[calc(100vh-8rem)] md:min-h-[520px] md:gap-4 md:p-6",
        /* On mobile an open conversation takes the whole surface. */
        selected ? "gap-0 p-0" : "gap-2 p-2",
      )}
    >
      <div
        className={cn(
          "flex-wrap items-center justify-between gap-3 md:flex",
          selected ? "hidden" : "flex",
        )}
      >
  <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <Badge variant="destructive">
              {t("messagesInbox.unreadTotal", { count: totalUnread })}
            </Badge>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Settings2 className="h-4 w-4" />
                {t("chat.notify.title")}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-4">
              <p className="text-sm font-medium">{t("chat.notify.title")}</p>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="notify-in-app" className="text-sm font-normal">
                  {t("chat.notify.inApp")}
                </Label>
                <Switch
                  id="notify-in-app"
                  checked={prefs.notify_in_app}
                  onCheckedChange={(v) => savePrefs({ notify_in_app: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="notify-email" className="text-sm font-normal">
                  {t("chat.notify.email")}
                </Label>
                <Switch
                  id="notify-email"
                  checked={prefs.notify_email}
                  onCheckedChange={(v) => savePrefs({ notify_email: v })}
                />
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full gap-1"
                  disabled={testingEmail}
                  onClick={handleTestEmail}
                >
                  <Send className="h-4 w-4" />
                  {t("chat.notify.testEmail")}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">{t("chat.notify.hint")}</p>

            </PopoverContent>
          </Popover>
          <StaffPickerDialog
            open={staffOpen}
            onOpenChange={setStaffOpen}
            excludeUserId={user?.id}
            onlineUserIds={online}
            onSelect={openDirectWith}
            hint={t("messagesInbox.directHint")}
            trigger={
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                {t("messagesInbox.newDirect")}
              </Button>
            }
          />

          {role === "team_member" && canStartTeamChat && !teamChatAccessLoading && (
            <StaffPickerDialog
              open={teamStaffOpen}
              onOpenChange={setTeamStaffOpen}
              excludeUserId={user?.id}
              onlineUserIds={online}
              onSelect={openTeamChatWith}
              hint={t("messagesInbox.teamChatHint", "Chat directly with other team members.")}
              teamOnly
              trigger={
                <Button size="sm" variant="outline" className="gap-1">
                  <Users className="h-4 w-4" />
                  {t("messagesInbox.newTeamChat", "Team chat")}
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Card className={cn("min-h-0 flex-1 overflow-hidden", FS_CHAT)}>
        <div className="flex h-full min-h-0">
          <aside className={cn("flex w-full shrink-0 flex-col border-e md:w-[360px]", selected && "hidden md:flex")}>
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("messagesInbox.search")}
                  className="ps-8"
                />
              </div>
              <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
                {filters.map((f) => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={filter === f.key ? "secondary" : "ghost"}
                    className="shrink-0 gap-1"
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                    {f.count ? <Badge variant="outline" className="px-1.5 text-[10px]">{f.count}</Badge> : null}
                  </Button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                  <MessageCircle className="h-5 w-5" />
                  <span>{t("messagesInbox.empty")}</span>
                </div>
              ) : (
                <ThreadList
                  items={items}
                  selectedId={selected?.id ?? null}
                  onSelect={(item) => setSelected({ type: item.type, id: item.id })}
                  muted={muted}
                />
              )}
            </div>
          </aside>

          <section className={cn("min-w-0 flex-1", !selected && "hidden md:flex md:items-center md:justify-center")}>
            {selected ? (
              <div className="flex h-full min-h-0 w-full flex-col">
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelected(null)}>
                    <BackIcon className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {selected.type === "case" ? activeCase?.caseName : activeDirect?.otherUserName}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {selected.type === "case" ? activeCase?.caseReference : getRoleLabel(activeDirect?.otherUserRole, t)}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={toggleMute} aria-label={isMuted ? t("chat.unmute") : t("chat.mute")}>
                    {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="min-h-0 flex-1">
                  {selected.type === "case" && activeCase ? (
                    <CaseMessages caseId={activeCase.caseId} />
                  ) : selected.type === "direct" && activeDirect ? (
                    <DirectMessages thread={activeDirect} currentUserId={user?.id ?? ""} />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex max-w-sm flex-col items-center gap-2 px-6 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8" />
                <p className="text-sm">{t("messagesInbox.selectHint")}</p>
              </div>
            )}
          </section>
        </div>
      </Card>
    </div>
  );
}
