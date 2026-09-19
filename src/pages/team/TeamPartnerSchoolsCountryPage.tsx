import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, ChevronRight, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, LoadingState, ErrorState } from "@/components/shell";
import { usePartnerCountries } from "@/hooks/usePartnerSchools";
import { useLang } from "@/hooks/useLang";

export default function TeamPartnerSchoolsCountryPage() {
  const { t } = useTranslation("dashboard");
  const lang = useLang();
  const { country: slug } = useParams();
  const { data, loading, error, refetch } = usePartnerCountries();

  const country = useMemo(
    () => (data?.countries ?? []).find((c) => c.slug === slug) ?? null,
    [data, slug],
  );
  const schools = useMemo(
    () => (data?.schools ?? []).filter((s) => country && s.country_id === country.id),
    [data, country],
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 px-4 pb-8 sm:px-6 lg:px-8">
      <PageHeader
        title={country ? `${country.flag_emoji ?? ""} ${lang === "ar" ? country.name_ar : country.name_en}`.trim() : t("partnerSchools.title", "Partner Schools")}
        subtitle={t("partnerSchools.countrySubtitle", "Partner language schools and their verified information.")}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/team/partner-schools">
              <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
              {t("partnerSchools.back", "Back")}
            </Link>
          </Button>
        }
      />

      {loading && <LoadingState rows={2} />}
      {error && <ErrorState title={error} onRetry={refetch} />}
      {!loading && !error && schools.length === 0 && (
        <EmptyState title={t("partnerSchools.noSchools", "No schools recorded for this country yet")} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {schools.map((s) => (
          <Link key={s.id} to={`/team/partner-schools/${slug}/${s.slug}`}>
            <Card className="flex h-full items-start justify-between gap-4 border-border px-5 py-4 transition-colors hover:border-brand/50 hover:bg-muted/40 sm:px-6">
              <div className="min-w-0 space-y-2">
                <div className="text-base font-semibold text-foreground">{s.name}</div>
                {s.city && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {s.city}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{t("partnerSchools.partnerSchool", "Partner School")}</Badge>
                  {(lang === "ar" ? s.standard_course_note_ar : s.standard_course_note_en) && (
                    <Badge className="bg-brand text-brand-foreground hover:bg-brand">
                      {t("partnerSchools.darbStandard", "DARB Standard")}
                    </Badge>
                  )}
                </div>
                <p className="max-w-prose text-xs leading-5 text-muted-foreground">
                  {lang === "ar" ? s.standard_course_note_ar : s.standard_course_note_en}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
