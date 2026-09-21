import { useState } from "react";
import { cn } from "@/lib/utils";

type IdentityStageProps = {
  name: string;
  imageUrl?: string;
  href: string;
  meta?: string;
  featured?: boolean;
  ratio?: "wide" | "square" | "compact";
};

const IdentityStage = ({ name, imageUrl, href, meta, featured = false, ratio = "wide" }: IdentityStageProps) => {
  const [failed, setFailed] = useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group grid min-h-32 min-w-0 place-items-center border border-border bg-background p-4 text-center transition-colors hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        featured && "sm:col-span-2",
      )}
    >
      <div className={cn("flex w-full min-w-0 items-center justify-center", ratio === "square" ? "h-16" : ratio === "compact" ? "h-10" : "h-14")}>
        {imageUrl && !failed ? (
          <img
            src={imageUrl}
            alt={`${name} logo`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className={cn("h-auto w-auto max-w-[88%] object-contain", ratio === "square" ? "max-h-16" : ratio === "compact" ? "max-h-9" : "max-h-12")}
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="max-w-full text-balance text-sm font-bold leading-5 text-primary">{name}</span>
        )}
      </div>
      {meta ? <span className="mt-2 text-xs text-muted-foreground">{meta}</span> : null}
    </a>
  );
};

export default IdentityStage;
