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
import { isVoiceAttachment, type ChatAttachment } from "@/lib/chatFormat";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatFullscreen } from "@/components/messages/chatFullscreen";
import CaseMessages from "@/components/cases/CaseMessages";
import DirectMessages from "@/components/messages/DirectMessages";
import VoiceCallButton from "@/components/messages/VoiceCallButton";
import ThreadList, { type ThreadCategory, type ThreadListItem } from "@/components/messages/ThreadList";
import StaffPickerDialog from "@/components/messages/StaffPickerDialog";
import {
  listMutedThreads,
  listMyCaseThreads,
  setThreadMuted,
  type CaseMessageThread,
} from "@/services/CaseMessageService";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  "max-md:fixed max-md:inset-0 max-md:z-[70] max-md:h-[100dvh] max-md:rounded-none max-md:border-0 max-md:shadow-none max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]";

type Filter = "all" | "teams" | "students" | "agents" | "partners" | "ambassadors";
type Category = Exclude<Filter, "all"> | "admins";

export function categoryForRole(r?: string | null): Category {
  if (r === "team_member") return "teams";
  if (r === "admin") return "admins";
  if (r === "agent") return "agents";
  if (r === "social_media_partner") return "partners";
  if (r === "ambassador") return "ambassadors";
  return "students";
}

type InboxItem = ThreadListItem & { group: Category };
const DISPLAY: Record<Category, ThreadCategory> = {
  admins: "direct",
  teams: "teams",
  students: "cases",
  agents: "partners",
  partners: "partners",
  ambassadors: "partners",
};

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
  useChatFullscreen(!!selected);
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
      .channel(`messages-inbox:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const items: InboxItem[] = useMemo(() => {
    const previewFor = (
      message: { body?: string | null; attachments?: ChatAttachment[] | null },
      fallback: string,
    ) => {
      if (message.body) return message.body;
      if ((message.attachments ?? []).some((att) => isVoiceAttachment(att))) {
        return t("chat.voice.message");
      }
      return fallback;
    };

    const caseItems: InboxItem[] = threads.map((thread) => ({
      id: thread.caseId,
      type: "case",
      category: "cases" as const,
      group: "students" as Category,
      title: thread.caseName,
      subtitle: thread.caseReference,
      preview: previewFor(thread.lastMessage, t("chat.attach.only")),
      timestamp: thread.lastMessage.created_at,
      unread: thread.unread,
    }));
    const isTeamRole = (r?: string | null) => r === "team_member";
    const directItems: InboxItem[] = directThreads
      // If team chat is disabled for this user, do not show peer team members at all
      .filter((thread) => (canStartTeamChat ? true : !isTeamRole(thread.otherUserRole)))
      .map((thread) => ({
        id: thread.threadId,
        type: "direct",
        category: DISPLAY[categoryForRole(thread.otherUserRole)],
        group: categoryForRole(thread.otherUserRole),
        title: thread.otherUserRole === "admin" ? t("chat.adminLabel") : thread.otherUserName,
        subtitle:
          thread.otherUserRole && thread.otherUserRole !== "admin"
            ? t(`case.messages.role.${thread.otherUserRole}`, thread.otherUserRole)
            : null,
        preview: thread.lastMessage
          ? previewFor(thread.lastMessage, t("messagesInbox.noMessagesYet"))
          : t("messagesInbox.noMessagesYet"),
        timestamp: thread.lastMessageAt,
        unread: thread.unread,
        otherUserId: thread.otherUserId,
      }));

    const q = query.trim().toLowerCase();
    return [...directItems, ...caseItems]
      .filter((item) => {
        if (filter !== "all" && item.group !== filter) return false;
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

  const visibleDirect = directThreads.filter((x) => (canStartTeamChat ? true : x.otherUserRole !== "team_member"));
  const unreadFor = (c: Category) =>
    visibleDirect.filter((x) => categoryForRole(x.otherUserRole) === c).reduce((sum, x) => sum + x.unread, 0) +
    (c === "students" ? threads.reduce((sum, x) => sum + x.unread, 0) : 0);
  const totalUnread =
    visibleDirect.reduce((sum, x) => sum + x.unread, 0) + threads.reduce((sum, x) => sum + x.unread, 0);

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
    { key: "all", label: t("chat.filter.all"), count: totalUnread },
    ...(canStartTeamChat ? [{ key: "teams" as const, label: t("chat.filter.teams"), count: unreadFor("teams") }] : []),
    { key: "students", label: t("chat.filter.students"), count: unreadFor("students") },
    ...(isAdmin
      ? [
          { key: "agents" as const, label: t("chat.filter.agents"), count: unreadFor("agents") },
          { key: "partners" as const, label: t("chat.filter.partners"), count: unreadFor("partners") },
          { key: "ambassadors" as const, label: t("chat.filter.ambassadors"), count: unreadFor("ambassadors") },
        ]
      : []),
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

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
        <Card
          className={cn(
            "min-h-0 flex-col overflow-hidden md:flex",
            selected ? "hidden" : "flex",
          )}
        >
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
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger aria-label={t("chat.filter.label")} className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filters.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                    {f.count ? ` (${f.count})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                onSelect={(item) => { if (item.type === "whatsapp") return; setSelected({ type: item.type, id: item.id }); }}
                emptyLabel={t("messagesInbox.empty")}
                onlineUserIds={online}
                grouped={false}
              />
            )}
          </div>
        </Card>

        <Card
          className={cn(
            "min-h-0 flex-col overflow-hidden md:flex md:rounded-lg md:border",
            selected ? `flex ${FS_CHAT}` : "hidden",
          )}
        >
          {activeCase || activeDirect ? (
            <>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-card p-2 md:p-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    aria-label={t("chat.back")}
                    onClick={() => setSelected(null)}
                  >
                    <BackIcon className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {activeCase ? activeCase.caseName : activeDirect!.otherUserName}
                    {activeDirect?.otherUserId && online.has(activeDirect.otherUserId) && (
                      <span className={`flex items-center gap-1 text-[11px] font-normal ${toneClasses("enrolled").text}`}>
                        <span className={`h-2 w-2 rounded-full ${toneClasses("enrolled").dot}`} />
                        {t("chat.presence.online")}
                      </span>
                    )}
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
                </div>
                <div className="flex shrink-0 items-center gap-1 md:gap-2">
                  {activeDirect && (
                    <VoiceCallButton
                      threadId={activeDirect.threadId}
                      otherUserId={activeDirect.otherUserId}
                      otherUserName={activeDirect.otherUserName}
                    />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 px-2 md:px-3"
                    onClick={toggleMute}
                    aria-label={isMuted ? t("chat.unmute") : t("chat.mute")}
                  >
                    {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    <span className="hidden md:inline">
                      {isMuted ? t("chat.unmute") : t("chat.mute")}
                    </span>
                  </Button>
                  {activeCase && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2 md:px-3"
                      onClick={() => navigate(`${basePath}/cases/${activeCase.caseId}`)}
                    >
                      <FolderOpen className="h-4 w-4 md:hidden" />
                      <span className="hidden md:inline">{t("messagesInbox.openCase")}</span>
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
                    className="flex min-h-0 flex-1 flex-col"
                  />
                ) : (
                  <DirectMessages
                    key={activeDirect!.threadId}
                    threadId={activeDirect!.threadId}
                    className="flex min-h-0 flex-1 flex-col"
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
