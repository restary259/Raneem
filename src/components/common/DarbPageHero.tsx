import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DarbPageHeroProps {
  /** The single primary title of the page. One page = one hero = one title. */
  title: string;
  /** Optional short supporting sentence in smaller typography. */
  subtitle?: string;
  /** Optional small category label. Never a second headline. */
  eyebrow?: string;
  imageUrl: string;
  imageAlt?: string;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  align?: "center" | "start";
}

const DarbPageHero: React.FC<DarbPageHeroProps> = ({
  title,
  subtitle,
  eyebrow,
  imageUrl,
  imageAlt = "",
  children,
  className,
  compact = false,
  align = "center",
}) => {
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-primary text-primary-foreground",
        compact ? "darb-page-hero-compact" : "darb-page-hero-standard",
        className,
      )}
    >
      <img
        src={imageUrl}
        alt={imageAlt}
        width={1920}
        height={900}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      {/* Subtle cinematic scrim: keeps the photography readable without a black box. */}
      <span aria-hidden="true" className="darb-hero-scrim absolute inset-0" />
      <div
        className={cn(
          "container relative z-10 flex items-center px-4",
          align === "center" ? "justify-center" : "justify-start",
          "darb-page-hero-inner",
        )}
      >
        <div
          className={cn(
            "darb-page-hero-panel bg-hero-panel/45 text-primary-foreground",
            align === "center" ? "text-center" : "text-start",
          )}
        >
          {eyebrow ? (
            <p className="darb-page-hero-eyebrow text-xs font-bold uppercase text-brand">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="darb-page-hero-title line-clamp-3 text-balance font-editorial font-semibold leading-[1.06]">
            {title}
          </h1>
          {subtitle ? (
            <p
              className={cn(
                "darb-page-hero-subtitle line-clamp-2 max-w-2xl text-base leading-8 text-primary-foreground/85",
                align === "center" && "mx-auto",
              )}
            >
              {subtitle}
            </p>
          ) : null}
          {children ? <div className="darb-page-hero-actions">{children}</div> : null}
        </div>
      </div>
      <span aria-hidden="true" className="darb-spectrum darb-spectrum-lg absolute inset-x-0 bottom-0 rounded-none" />
    </section>
  );
};

export default DarbPageHero;
