import { useTranslation } from "react-i18next";
import { Link } from "@/lib/router-compat";
import { ChevronRight, Building2, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, LoadingState, ErrorState } from "@/components/shell";
import { usePartnerCountries } from "@/hooks/usePartnerSchools";
import { useLang } from "@/hooks/useLang";

export default function TeamPartnerSchoolsPage() {
  const { t } = useTranslation("dashboard");
  const lang = useLang();
  const { data, loading, error, refetch } = usePartnerCountries();

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 px-4 pb-8 sm:px-6 lg:px-8">
      <PageHeader
        title={t("partnerSchools.title", "Partner Schools")}
        subtitle={t(
          "partnerSchools.subtitle",
          "Access partner school information, pricing, accommodation and application details.",
        )}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/team/catalog">
              {t("partnerSchools.openCatalog", "Open DARB Catalog")}
              <ExternalLink className="ms-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      {loading && <LoadingState rows={2} />}
      {error && <ErrorState title={error} onRetry={refetch} />}
      {!loading && !error && (data?.countries.length ?? 0) === 0 && (
        <EmptyState title={t("partnerSchools.noCountries", "No countries recorded yet")} />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.countries ?? []).map((c) => {
          const count = (data?.schools ?? []).filter((s) => s.country_id === c.id).length;
          return (
            <Link key={c.id} to={`/team/partner-schools/${c.slug}`}>
              <Card className="flex h-full items-center justify-between gap-4 border-border px-5 py-4 transition-colors hover:border-brand/50 hover:bg-muted/40 sm:px-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <span aria-hidden>{c.flag_emoji}</span>
                    <span className="truncate">{lang === "ar" ? c.name_ar : c.name_en}</span>
                  </div>
                  <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">
                    {lang === "ar" ? c.description_ar : c.description_en}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    {count} {t("partnerSchools.schools", "schools")}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
