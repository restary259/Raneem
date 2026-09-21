import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DarbPageHeroProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  imageUrl: string;
  imageAlt?: string;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
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
      <div className="absolute inset-0 bg-hero-panel/10" />
      <div
        className={cn(
          "container relative z-10 flex items-center justify-center px-4",
          "darb-page-hero-inner",
        )}
      >
        <div
          className={cn(
            "darb-page-hero-panel w-full bg-hero-panel/80 text-center shadow-surface-lg backdrop-blur-[2px]",
          )}
        >
          {eyebrow ? (
            <p className="text-sm font-semibold text-primary-foreground/90">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className="darb-page-hero-title font-bold leading-tight"
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="darb-page-hero-subtitle mx-auto mt-5 max-w-2xl text-base leading-8 text-primary-foreground/90">
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
