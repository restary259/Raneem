import { useTranslation } from "react-i18next";
import { GraduationCap, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLang } from "@/hooks/useLang";
import CatalogImage from "./CatalogImage";
import {
  type CatalogProgram,
  localizedName,
  localizedDescription,
  primaryPhoto,
  programSummary,
  formatMoney,
} from "@/lib/catalogDisplay";
import { parseWeekTiers } from "@/lib/programPricing";

interface ProgramCardProps {
  program: CatalogProgram;
  onOpenPhotos?: (program: CatalogProgram) => void;
}

export function ProgramCard({ program, onOpenPhotos }: ProgramCardProps) {
  const { t } = useTranslation("dashboard");
  const lang = useLang();
  const photo = primaryPhoto(program.photos);
  const description = localizedDescription(program, lang);
  const currency = program.currency || "EUR";
  const chips = programSummary(program, {
    lessons: t("catalog.lessonsPerWeek", "lessons/week"),
    hours: t("catalog.hoursPerWeek", "hours/week"),
  });

  const tiers = parseWeekTiers(program.price_tiers)
    .filter((tier) => tier.price != null)
    .sort((a, b) => (a.from_weeks ?? 1) - (b.from_weeks ?? 1));

  const headlinePrice = tiers.length
    ? Math.min(...tiers.map((tier) => tier.price as number))
    : program.price;

  return (
    <Card className={cn("overflow-hidden", !program.is_active && "opacity-60")}>
      <div className="flex flex-col sm:flex-row">
        <button
          type="button"
          onClick={() => onOpenPhotos?.(program)}
          disabled={!photo || !onOpenPhotos}
          aria-label={localizedName(program, lang)}
          className="w-full shrink-0 text-start sm:w-56 xl:w-64 disabled:cursor-default"
        >
          <CatalogImage
            src={photo}
            alt={localizedName(program, lang)}
            aspect="aspect-[16/9] sm:aspect-[4/3] h-full"
            icon={GraduationCap}
          />
        </button>

        <div className="min-w-0 flex-1 space-y-2 p-4 xl:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-tight xl:text-lg">{localizedName(program, lang)}</h3>
              {program.type && (
                <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">{program.type}</p>
              )}
            </div>
            {headlinePrice != null && (
              <div className="text-end">
                <span className="text-xl font-bold text-primary xl:text-2xl">
                  {formatMoney(headlinePrice, currency)}
                </span>
                <span className="ms-1 text-xs text-muted-foreground">/ {t("catalog.week", "week")}</span>
              </div>
            )}
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <Badge key={chip} variant="secondary" className="font-normal">
                  {chip}
                </Badge>
              ))}
            </div>
          )}

          {description && <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>}

          {tiers.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {tiers.map((tier, i) => {
                const from = tier.from_weeks ?? 1;
                const to = tier.to_weeks;
                const label = to == null
                  ? (from <= 1 ? t("catalog.allWeeks", "All weeks") : `${from}+ ${t("catalog.weeks", "weeks")}`)
                  : from === to
                    ? `${from} ${t("catalog.week", "week")}`
                    : `${from}-${to} ${t("catalog.weeks", "weeks")}`;
                return (
                  <span
                    key={`tier-${i}`}
                    className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground"
                  >
                    {label}: <span className="font-medium text-foreground">{formatMoney(tier.price ?? null, currency)}</span>
                  </span>
                );
              })}
            </div>
          )}

          {program.registration_fee != null && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {t("catalog.registrationFee", "Registration fee")}: {formatMoney(program.registration_fee, currency)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default ProgramCard;
