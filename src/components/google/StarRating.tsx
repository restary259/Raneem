import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Read-only 1-5 star display. Google's star enum is mapped to an integer in the
 * gateway, so this only ever renders whole stars.
 */
export function StarRating({
  rating,
  className,
  size = "sm",
}: {
  rating: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  const iconClass = size === "md" ? "size-5" : "size-4";
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${clamped} / 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            iconClass,
            n <= clamped
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}
