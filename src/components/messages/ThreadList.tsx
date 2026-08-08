import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/chatFormat";

export interface ThreadListItem {
  id: string;
  title: string;
  subtitle?: string | null;
  preview: string;
  timestamp: string | null;
  unread: number;
  type: "case" | "direct";
}

interface ThreadListProps {
  items: ThreadListItem[];
  selectedId: string | null;
  onSelect: (item: ThreadListItem) => void;
  emptyLabel: string;
}

export default function ThreadList({ items, selectedId, onSelect, emptyLabel }: ThreadListProps) {
  const { t } = useTranslation("dashboard");

  if (items.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={`${item.type}-${item.id}`}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "flex w-full items-start gap-3 px-3 py-3 text-start transition-colors hover:bg-accent",
              selectedId === item.id && "bg-accent",
            )}
          >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {initials(item.title)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{item.title}</span>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {t(`chat.type.${item.type}`)}
                </Badge>
              </div>
              {item.subtitle && (
                <p className="truncate text-[11px] text-muted-foreground">{item.subtitle}</p>
              )}
              <p className="truncate text-xs text-muted-foreground">{item.preview}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {item.timestamp && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(item.timestamp).toLocaleDateString("en-US")}
                </span>
              )}
              {item.unread > 0 && (
                <Badge className="h-5 min-w-5 justify-center px-1.5 text-[10px]">{item.unread}</Badge>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
