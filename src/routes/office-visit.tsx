import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PublicOfficeBooking from "@/components/apply/PublicOfficeBooking";

export const Route = createFileRoute("/office-visit")({
  validateSearch: (search: Record<string, unknown>) => ({ token: typeof search.token === "string" ? search.token : "" }),
  head: () => ({ meta: [
    { title: "Manage your DARB office visit | درب" },
    { name: "description", content: "Manage a requested visit to DARB's Tamra office." },
    { property: "og:title", content: "Manage your DARB office visit | درب" },
    { property: "og:description", content: "Manage a requested visit to DARB's Tamra office." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: OfficeVisit,
});

function OfficeVisit() {
  const { token } = Route.useSearch();
  const { t } = useTranslation("landing");
  return <main className="mx-auto max-w-lg space-y-8 px-5 py-10 sm:py-16">
    <div className="space-y-3 text-start"><p className="text-xs font-semibold text-brand-strong">{t("apply.officeLocation")}</p><h1 className="text-3xl font-bold leading-tight text-foreground">{t("apply.manageVisit")}</h1>
    <p className="text-sm leading-7 text-muted-foreground">{t("apply.officeNext")}</p></div>
    <div className="border-t border-border pt-7">{token ? <PublicOfficeBooking token={token} /> : <p role="alert" className="border-s-2 border-destructive bg-muted px-4 py-3 text-sm leading-6 text-foreground">{t("apply.invalidVisitLink")}</p>}</div>
  </main>;
}