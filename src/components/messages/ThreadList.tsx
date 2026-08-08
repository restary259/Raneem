import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatThreadTime, initials } from "@/lib/chatFormat";

export interface ThreadListItem {
  id: string;
  title: string;
  subtitle?: string | null;
  preview: string;
  timestamp: string | null;
  unread: number;
  type: "case" | "direct";
  /** Direct threads only — used for the presence dot. */
  otherUserId?: string | null;
}

interface ThreadListProps {
  items: ThreadListItem[];
  selectedId: string | null;
  onSelect: (item: ThreadListItem) => void;
  emptyLabel: string;
  onlineUserIds?: Set<string>;
}

export default function ThreadList({
  items,
  selectedId,
  onSelect,
  emptyLabel,
  onlineUserIds,
}: ThreadListProps) {
  const { t } = useTranslation("dashboard");

  if (items.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y">
      {items.map((item) => {
        const active = selectedId === item.id;
        const online = !!item.otherUserId && !!onlineUserIds?.has(item.otherUserId);
        return (
          <li key={`${item.type}-${item.id}`}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "flex w-full items-start gap-3 px-3 py-3 text-start transition-colors",
                active
                  ? "bg-primary/10 ltr:border-l-2 rtl:border-r-2 border-primary"
                  : "hover:bg-accent/60",
              )}
            >
              <div className="relative mt-0.5 shrink-0">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold",
                    item.type === "case"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-primary/15 text-primary",
                  )}
                >
                  {initials(item.title)}
                </div>
                {online && (
                  <span
                    title={t("chat.presence.online")}
                    className="absolute -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card ltr:-right-0.5 rtl:-left-0.5"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-sm",
                      item.unread > 0 ? "font-bold" : "font-medium",
                    )}
                  >
                    {item.title}
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[11px] font-normal">
                    {t(`chat.type.${item.type}`)}
                  </Badge>
                </div>
                {item.subtitle && (
                  <p className="truncate text-[11px] text-muted-foreground">{item.subtitle}</p>
                )}
                <p
                  className={cn(
                    "truncate text-xs",
                    item.unread > 0 ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.preview}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatThreadTime(item.timestamp)}
                </span>
                {item.unread > 0 && (
                  <Badge className="h-5 min-w-5 justify-center px-1.5 text-[11px] tabular-nums">
                    {item.unread}
                  </Badge>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
