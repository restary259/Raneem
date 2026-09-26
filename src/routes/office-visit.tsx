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
  return <main className="mx-auto max-w-xl space-y-6 px-5 py-16">
    <h1 className="text-3xl font-bold text-foreground">{t("apply.manageVisit")}</h1>
    <p className="text-muted-foreground">{t("apply.officeNext")}</p>
    {token ? <PublicOfficeBooking token={token} /> : <p role="alert" className="text-destructive">{t("apply.bookingUnavailable")}</p>}
  </main>;
}