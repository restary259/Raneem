import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Pencil, Pause, Play, Trash2 } from "lucide-react";
import { toneClasses } from "@/lib/statusTokens";
import { parseAgeTiers, formatAgeLadder } from "@/lib/insurancePricing";
import { cn } from "@/lib/utils";
import { Insurance } from "./types";

const TONE = {
  enrolled: toneClasses("enrolled").chip,
  payment: toneClasses("payment").chip,
} as const;

const TONE_TEXT = {
  enrolled: toneClasses("enrolled").text,
} as const;

interface InsuranceSectionProps {
  insurances: Insurance[];
  loading: boolean;
  addTrigger: React.ReactNode;
  onEdit: (i: Insurance) => void;
  onToggle: (i: Insurance) => void;
  onDelete: (i: Insurance) => void;
}

/** Global insurance catalog — not school-specific, lives outside the columns. */
const InsuranceSection = ({ insurances, loading, addTrigger, onEdit, onToggle, onDelete }: InsuranceSectionProps) => {
  const { t } = useTranslation("dashboard");

  const tierColor: Record<string, string> = {
    basic: toneClasses("new").chip,
    standard: toneClasses("appointment").chip,
    premium: toneClasses("payment").chip,
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t("admin.programs.tabInsurance")}</h2>
          <p className="text-xs text-muted-foreground">{t("admin.programs.insuranceGlobalNote")}</p>
        </div>
        {addTrigger}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {insurances.map((ins) => (
          <Card
            key={ins.id}
            className={cn("overflow-hidden hover:shadow-md transition-all", !ins.is_active && "opacity-60")}
          >
            <CardContent className="p-0">
              {ins.photos && ins.photos.length > 0 && (
                <div className="relative h-28 w-full">
                  <img src={ins.photos[0]} alt={ins.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--status-enrolled)/0.12)]">
                    <Shield className={cn("h-4 w-4", TONE_TEXT.enrolled)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{ins.name}</p>
                    <Badge className={cn("text-xs mt-0.5", tierColor[ins.tier] ?? "bg-muted text-muted-foreground")}>
                      {ins.tier}
                    </Badge>
                  </div>
                </div>
                {parseAgeTiers(ins.age_price_tiers).length > 0 ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      TONE.enrolled,
                    )}
                  >
                    💰{" "}
                    {formatAgeLadder(
                      parseAgeTiers(ins.age_price_tiers),
                      ins.currency === "EUR" ? "€" : "₪",
                      t("admin.programs.ageAndAbove"),
                    )}
                  </span>
                ) : ins.price > 0 ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      TONE.enrolled,
                    )}
                  >
                    💰 {ins.price.toLocaleString("en-US")} {ins.currency}/mo
                  </span>
                ) : (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      TONE.payment,
                    )}
                  >
                    {t("admin.programs.noPriceSet")}
                  </span>
                )}
                {ins.provider && <p className="text-xs text-muted-foreground">{ins.provider}</p>}
                {ins.coverage_scope && (
                  <p className="text-xs text-muted-foreground">
                    {t(`admin.programs.coverage.${ins.coverage_scope}`)}
                  </p>
                )}
                {(ins.min_months || ins.max_months || ins.max_age) && (
                  <p className="text-xs text-muted-foreground">
                    {ins.min_months && ins.max_months
                      ? t("admin.programs.termRange", { min: ins.min_months, max: ins.max_months })
                      : null}
                    {ins.max_age ? ` · ${t("admin.programs.maxAgeShort", { age: ins.max_age })}` : null}
                  </p>
                )}
                {ins.terms_url && (
                  <a
                    href={ins.terms_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-medium text-primary underline"
                  >
                    {t("admin.programs.viewTerms")}
                  </a>
                )}
              </div>
              <div className="flex items-center justify-end gap-1 border-t bg-muted/30 px-3 py-2">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onEdit(ins)}>
                  <Pencil className="h-3 w-3" />
                  {t("admin.programs.btnEdit")}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onToggle(ins)}>
                  {ins.is_active ? (
                    <>
                      <Pause className="h-3 w-3" />
                      {t("admin.programs.btnPause")}
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" />
                      {t("admin.programs.btnActivate")}
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(ins)}
                >
                  <Trash2 className="h-3 w-3" />
                  {t("admin.programs.btnDelete")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && insurances.length === 0 && (
          <p className="col-span-3 text-center text-sm text-muted-foreground py-8">
            {t("admin.programs.noInsurance")}
          </p>
        )}
      </div>
    </section>
  );
};

export default InsuranceSection;
