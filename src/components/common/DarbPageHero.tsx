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
        compact
          ? "min-h-[360px] md:min-h-[470px]"
          : "min-h-[430px] md:min-h-[580px]",
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
      <div className="absolute inset-0 bg-primary/15" />
      <div className="container relative z-10 flex min-h-[430px] items-center justify-center px-4 pb-16 pt-28 md:min-h-[580px] md:pb-20 md:pt-40">
        <div
          className={cn(
            "w-full bg-primary/70 text-center shadow-surface-lg backdrop-blur-[2px]",
            compact
              ? "max-w-2xl px-6 py-8 md:px-12 md:py-10"
              : "max-w-3xl px-6 py-10 md:px-14 md:py-14",
          )}
        >
          {eyebrow ? (
            <p className="text-sm font-semibold text-primary-foreground/90">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              "font-bold leading-tight",
              compact
                ? "text-4xl md:text-6xl"
                : "text-4xl md:text-7xl",
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-primary-foreground/90 md:text-lg">
              {subtitle}
            </p>
          ) : null}
          {children ? <div className="mt-7">{children}</div> : null}
        </div>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 grid h-3 grid-cols-7"
        aria-hidden="true"
      >
        <span className="bg-destructive" />
        <span className="bg-brand" />
        <span className="bg-accent" />
        <span className="bg-primary" />
        <span className="bg-trust" />
        <span className="bg-secondary" />
        <span className="bg-brand" />
      </div>
    </section>
  );
};

export default DarbPageHero;
