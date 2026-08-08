import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import DirectMessages from "@/components/messages/DirectMessages";
import ThreadList, { type ThreadListItem } from "@/components/messages/ThreadList";
import {
  listMyDirectThreads,
  listStaffDirectory,
  startDirectThread,
  type DirectThread,
  type StaffMember,
} from "@/services/DirectMessageService";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";

/** Partners and ambassadors talk directly with the Darb admins. */
export default function PartnerMessagesPage() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const online = useOnlineUsers();

  const [threads, setThreads] = useState<DirectThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [staffOpen, setStaffOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const rows = await listMyDirectThreads(user.id);
      setThreads(rows);
      setSelected((current) => current ?? rows[0]?.threadId ?? null);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

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
      setSelected(threadId);
      await load();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const items: ThreadListItem[] = threads.map((thread) => ({
    id: thread.threadId,
    type: "direct",
    title: thread.otherUserName,
    subtitle: thread.otherUserRole
      ? t(`case.messages.role.${thread.otherUserRole}`, thread.otherUserRole)
      : null,
    preview: thread.lastMessage?.body || t("messagesInbox.noMessagesYet"),
    timestamp: thread.lastMessageAt,
    unread: thread.unread,
    otherUserId: thread.otherUserId,
  }));

  const active = threads.find((thread) => thread.threadId === selected) ?? null;

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[520px] flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("messagesInbox.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("messagesInbox.partnerSubtitle")}</p>
        </div>
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
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            online.has(member.id) ? "bg-emerald-500" : "bg-muted-foreground/40",
                          )}
                        />
                        {member.full_name}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {t(`case.messages.role.${member.role}`, member.role)}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[300px_1fr]">
        <Card className={cn("min-h-0 flex-col overflow-hidden md:flex", selected ? "hidden" : "flex")}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ThreadList
                items={items}
                selectedId={selected}
                onSelect={(item) => setSelected(item.id)}
                emptyLabel={t("messagesInbox.empty")}
                onlineUserIds={online}
              />
            )}
          </div>
        </Card>

        <Card className={cn("min-h-0 flex-col overflow-hidden md:flex", selected ? "flex" : "hidden")}>
          {active ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{active.otherUserName}</p>
                  {active.otherUserId && online.has(active.otherUserId) && (
                    <p className="flex items-center gap-1 text-[11px] text-emerald-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {t("chat.presence.online")}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="md:hidden"
                  onClick={() => setSelected(null)}
                >
                  {t("chat.back")}
                </Button>
              </div>
              <DirectMessages
                threadId={active.threadId}
                className="flex min-h-0 flex-1 flex-col"
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">{t("messagesInbox.empty")}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
