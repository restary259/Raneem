import React from "react";
import { Mail, MessageCircle, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "@/lib/router-compat";
import { useDirection } from "@/hooks/useDirection";
import { DARB_CONTACT_ADVISOR_SRC } from "@/assets/darbContactAdvisor";
import { SUPPORT_EMAIL, SUPPORT_PHONE, whatsappBusinessUrl } from "@/lib/contactConfig";
import { cn } from "@/lib/utils";

type Variant = "default" | "compact" | "partner";

interface DarbContactCtaProps {
  variant?: Variant;
  className?: string;
}

const DarbContactCta: React.FC<DarbContactCtaProps> = ({
  variant = "default",
  className,
}) => {
  const { t } = useTranslation();
  const { dir } = useDirection();
  const partner = variant === "partner";
  const compact = variant === "compact";

  const title = partner
    ? t("contactCta.partnerTitle")
    : compact
      ? t("contactCta.compactTitle")
      : t("contactCta.title");

  const subtitle = partner
    ? t("contactCta.partnerSubtitle")
    : compact
      ? t("contactCta.compactSubtitle")
      : t("contactCta.subtitle");

  return (
    <section
      dir={dir}
      className={cn(
        "border-y border-border bg-editorial-paper text-foreground",
        compact ? "py-10 md:py-12" : "py-12 md:py-16",
        className,
      )}
    >
      <div className="container mx-auto px-4">
        <div
          className={cn(
            "mx-auto flex max-w-6xl flex-col items-center gap-6",
            !compact && !partner ? "md:flex-row md:items-center md:justify-between md:gap-12" : "md:block",
          )}
        >
          {!compact && !partner ? (
            <div className="shrink-0 md:order-2">
              <div className="relative">
                <div className="absolute -inset-2 rounded-full bg-primary/8" aria-hidden="true" />
                <div className="relative aspect-square w-32 shrink-0 overflow-hidden rounded-full border-4 border-background shadow-surface-lg ring-1 ring-border sm:w-36 md:w-44">
                  <img
                    src={DARB_CONTACT_ADVISOR_SRC}
                    alt={t("contactCta.eyebrow")}
                    className="size-full rounded-full object-cover object-[50%_42%]"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className={cn("w-full text-center md:text-start", compact || partner ? "max-w-4xl mx-auto" : "max-w-2xl md:order-1")}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              {partner ? t("contactCta.partnerEyebrow") : t("contactCta.eyebrow")}
            </p>

            <h2
              className={cn(
                "mt-3 font-semibold tracking-tight text-foreground",
                compact ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl",
              )}
            >
              {title}
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:mx-0 md:text-base">
              {subtitle}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <a
                href={whatsappBusinessUrl(
                  "مرحبا، بدي أتواصل مع فريق درب بخصوص الدراسة بألمانيا.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <MessageCircle className="h-4 w-4" />
                {t("contactCta.whatsapp")}
              </a>

              <Link
                to="/contact"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Mail className="h-4 w-4" />
                {partner ? t("contactCta.partnerContact") : t("contactCta.contact")}
              </Link>

              <Link
                to={partner ? "/partnership" : "/apply"}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-primary bg-primary/5 px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                {partner ? t("contactCta.partnerApply") : t("contactCta.apply")}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 flex flex-col items-center gap-1 text-xs text-muted-foreground md:flex-row md:items-start md:gap-4" dir="ltr">
              <a
                href={whatsappBusinessUrl(
                  "مرحبا، بدي أتواصل مع فريق درب بخصوص الدراسة بألمانيا.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-primary"
              >
                {SUPPORT_PHONE}
              </a>
              <span className="hidden md:inline" aria-hidden="true">·</span>
              <a
                href={"mailto:" + SUPPORT_EMAIL}
                className="hover:text-foreground"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default DarbContactCta;
