import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CrumbItem {
  label: string;
  /** Omit on the last (current) crumb. */
  onClick?: () => void;
}

/** Country › City › School › Item breadcrumb shared by both catalog surfaces. */
export function CatalogBreadcrumb({ items, className }: { items: CrumbItem[]; className?: string }) {
  const visible = items.filter((i) => i.label);
  if (visible.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex flex-wrap items-center gap-1 text-sm", className)}>
      {visible.map((item, i) => {
        const last = i === visible.length - 1;
        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 rtl:rotate-180" aria-hidden />
            )}
            {item.onClick && !last ? (
              <button
                type="button"
                onClick={item.onClick}
                className="rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </button>
            ) : (
              <span className={cn("px-1 py-0.5", last ? "font-medium text-foreground" : "text-muted-foreground")} aria-current={last ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

export default CatalogBreadcrumb;
