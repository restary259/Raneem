import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaginationState } from "@/hooks/usePagination";

interface Props {
  pagination: PaginationState<unknown>;
  pageSizeOptions?: number[];
}

const fmt = (n: number) => n.toLocaleString("en-US");

/** Shared footer control for paginated staff tables. */
export default function TablePagination({ pagination, pageSizeOptions = [25, 50, 100] }: Props) {
  const { t } = useTranslation("dashboard");
  const { page, pageCount, total, from, to, pageSize, setPageSize, next, prev, canNext, canPrev } =
    pagination;

  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
      <p className="text-xs text-muted-foreground">
        {t("common.pagination.showing", {
          from: fmt(from),
          to: fmt(to),
          total: fmt(total),
          defaultValue: "Showing {{from}}–{{to}} of {{total}}",
        })}
      </p>

      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((s) => (
              <SelectItem key={s} value={String(s)} className="text-xs">
                {t("common.pagination.perPage", { count: s, defaultValue: "{{count}} / page" })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={prev}
          disabled={!canPrev}
          aria-label={t("common.pagination.previous", "Previous page")}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>

        <span className="text-xs text-muted-foreground tabular-nums">
          {fmt(page)} / {fmt(pageCount)}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={next}
          disabled={!canNext}
          aria-label={t("common.pagination.next", "Next page")}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
