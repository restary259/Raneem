import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { listStaffDirectory, type StaffMember } from "@/services/DirectMessageService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered as the dialog trigger, e.g. the "new direct message" button. */
  trigger: React.ReactNode;
  /** Own user id, filtered out of the directory. */
  excludeUserId?: string;
  onlineUserIds: Set<string>;
  onSelect: (staffId: string) => void;
  hint?: string;
}

/** Directory of staff members to start a direct conversation with. */
export default function StaffPickerDialog({
  open,
  onOpenChange,
  trigger,
  excludeUserId,
  onlineUserIds,
  onSelect,
  hint,
}: Props) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);
    listStaffDirectory()
      .then((rows) => {
        setStaff(rows.filter((s) => s.id !== excludeUserId));
        setLoaded(true);
      })
      .catch((err: unknown) => {
        toast({ variant: "destructive", description: (err as Error).message });
      })
      .finally(() => setLoading(false));
  }, [open, loaded, excludeUserId, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("messagesInbox.pickStaff")}</DialogTitle>
        </DialogHeader>
        {loading ? (
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
                  onClick={() => onSelect(member.id)}
                  className="flex w-full items-center justify-between rounded-md p-2 text-start transition-colors hover:bg-muted"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        onlineUserIds.has(member.id)
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/40",
                      )}
                      title={t(
                        onlineUserIds.has(member.id)
                          ? "chat.presence.online"
                          : "chat.presence.offline",
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
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </DialogContent>
    </Dialog>
  );
}
