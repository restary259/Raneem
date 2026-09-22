import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";
import BrandArch from "@/components/landing/home/BrandArch";

interface DarbPageHeroProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  imageUrl: string;
  imageAlt?: string;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  align?: "center" | "start";
  showArch?: boolean;
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
  showArch = true,
}) => {
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-primary text-foreground",
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
      <div className="absolute inset-0 bg-primary/3" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/15 via-transparent to-background/5" />
      {showArch ? <BrandArch className="opacity-45" /> : null}
      <div
        className={cn(
          "container relative z-10 flex items-center px-4",
          align === "center" ? "justify-center" : "justify-start",
          "darb-page-hero-inner",
        )}
      >
        <div
          className={cn(
            "darb-page-hero-panel w-full max-w-4xl border border-background/55 bg-background/72 text-foreground shadow-surface-lg backdrop-blur-[3px]",
            align === "center" ? "text-center" : "text-start",
          )}
        >
          {eyebrow ? (
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand sm:text-sm">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className="darb-page-hero-title font-bold leading-tight"
          >
            {title}
          </h1>
          {subtitle ? (
            <p className={cn("darb-page-hero-subtitle mt-5 max-w-2xl text-base leading-8 text-foreground/75", align === "center" && "mx-auto")}>
              {subtitle}
            </p>
          ) : null}
          {children ? <div className="mt-7">{children}</div> : null}
        </div>
      </div>
      <span aria-hidden="true" className="darb-spectrum darb-spectrum-lg absolute inset-x-0 bottom-0 rounded-none" />
    </section>
  );
};

export default DarbPageHero;