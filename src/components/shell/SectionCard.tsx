import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Right side of the header (badge, link, small action). */
  actions?: React.ReactNode;
  /** Makes the body collapsible — used for secondary information. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Remove body padding (lists / tables that manage their own rows). */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * The only card wrapper for grouped dashboard content. Collapsible mode is the
 * progressive-disclosure tool that keeps secondary information off the first
 * screen without hiding it from the user.
 */
export default function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  collapsible = false,
  defaultOpen = true,
  flush = false,
  className,
  children,
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const isOpen = collapsible ? open : true;

  return (
    <Card className={cn("overflow-hidden border-border/70", className)}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b border-border/50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {collapsible ? (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={isOpen}
                aria-controls={bodyId}
                className="flex min-w-0 items-center gap-2 rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="min-w-0">
                  <CardTitle className="truncate text-sm font-semibold">{title}</CardTitle>
                  {description && (
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {description}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                <div className="min-w-0">
                  <CardTitle className="truncate text-sm font-semibold">{title}</CardTitle>
                  {description && (
                    <p className="truncate text-xs font-normal text-muted-foreground">{description}</p>
                  )}
                </div>
              </div>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </CardHeader>
      )}
      {isOpen && (
        <CardContent id={bodyId} className={cn(flush ? "p-0" : "p-4")}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}
