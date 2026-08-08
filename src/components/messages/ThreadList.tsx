import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatThreadTime, initials } from "@/lib/chatFormat";

/** Sidebar sections, in the order staff work through them. */
export type ThreadCategory = "direct" | "cases" | "partners";

export const THREAD_CATEGORY_ORDER: ThreadCategory[] = ["direct", "cases", "partners"];

/** One restrained colour identity per section — indicators only, never fills. */
const CATEGORY_STYLE: Record<
  ThreadCategory,
  { bar: string; avatar: string; badge: string; dot: string }
> = {
  direct: {
    bar: "bg-primary",
    avatar: "bg-primary/15 text-primary",
    badge: "border-primary/30 text-primary",
    dot: "bg-primary",
  },
  cases: {
    bar: "bg-sky-500",
    avatar: "bg-sky-100 text-sky-700",
    badge: "border-sky-300 text-sky-700",
    dot: "bg-sky-500",
  },
  partners: {
    bar: "bg-amber-500",
    avatar: "bg-amber-100 text-amber-800",
    badge: "border-amber-300 text-amber-800",
    dot: "bg-amber-500",
  },
};

export interface ThreadListItem {
  id: string;
  title: string;
  subtitle?: string | null;
  preview: string;
  timestamp: string | null;
  unread: number;
  type: "case" | "direct";
  /** Sidebar section this thread belongs to. */
  category?: ThreadCategory;
  /** Direct threads only — used for the presence dot. */
  otherUserId?: string | null;
}

interface ThreadListProps {
  items: ThreadListItem[];
  selectedId: string | null;
  onSelect: (item: ThreadListItem) => void;
  emptyLabel: string;
  onlineUserIds?: Set<string>;
  /** Render labelled Direct / Cases / Partners sections. */
  grouped?: boolean;
}

export default function ThreadList({
  items,
  selectedId,
  onSelect,
  emptyLabel,
  onlineUserIds,
  grouped = false,
}: ThreadListProps) {
  const { t } = useTranslation("dashboard");

  if (items.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const categoryOf = (item: ThreadListItem): ThreadCategory =>
    item.category ?? (item.type === "case" ? "cases" : "direct");

  const renderRow = (item: ThreadListItem) => {
    const active = selectedId === item.id;
    const online = !!item.otherUserId && !!onlineUserIds?.has(item.otherUserId);
    const style = CATEGORY_STYLE[categoryOf(item)];
    return (
      <li key={`${item.type}-${item.id}`}>
        <button
          type="button"
          onClick={() => onSelect(item)}
          className={cn(
            "relative flex w-full items-start gap-3 px-3 py-3 text-start transition-colors",
            active ? "bg-muted" : "hover:bg-muted/60",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-0 w-1 ltr:left-0 rtl:right-0",
              active ? style.bar : "bg-transparent",
            )}
          />
          <div className="relative mt-0.5 shrink-0">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold",
                style.avatar,
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
                className={cn("truncate text-sm", item.unread > 0 ? "font-bold" : "font-medium")}
              >
                {item.title}
              </span>
              {!grouped && (
                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-[11px] font-normal", style.badge)}
                >
                  {t(`chat.type.${item.type}`)}
                </Badge>
              )}
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
  };

  if (!grouped) {
    return <ul className="divide-y">{items.map(renderRow)}</ul>;
  }

  return (
    <div>
      {THREAD_CATEGORY_ORDER.map((category) => {
        const rows = items.filter((item) => categoryOf(item) === category);
        if (rows.length === 0) return null;
        const unread = rows.reduce((sum, row) => sum + row.unread, 0);
        const style = CATEGORY_STYLE[category];
        return (
          <section key={category}>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted/70 px-3 py-1.5 backdrop-blur">
              <span className={cn("h-2 w-2 rounded-full", style.dot)} aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`chat.section.${category}`)}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {rows.length}
              </span>
              {unread > 0 && (
                <Badge className="ms-auto h-5 min-w-5 justify-center px-1.5 text-[11px] tabular-nums">
                  {unread}
                </Badge>
              )}
            </div>
            <ul className="divide-y">{rows.map(renderRow)}</ul>
          </section>
        );
      })}
    </div>
  );
}
