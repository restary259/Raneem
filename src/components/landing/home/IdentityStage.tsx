import { useState } from "react";
import { cn } from "@/lib/utils";

type IdentityStageProps = {
  name: string;
  imageUrl?: string;
  href: string;
  meta?: string;
  featured?: boolean;
};

const IdentityStage = ({ name, imageUrl, href, meta, featured = false }: IdentityStageProps) => {
  const [failed, setFailed] = useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group grid min-h-28 min-w-0 place-items-center border border-border bg-background p-4 text-center transition-colors hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        featured && "sm:col-span-2",
      )}
    >
      <div className="flex h-12 w-full min-w-0 items-center justify-center">
        {imageUrl && !failed ? (
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="max-h-11 max-w-[90%] object-contain"
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
