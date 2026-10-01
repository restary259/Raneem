import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { MapPin, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGoogleBusinessOverview } from "@/lib/googleBusinessConnection.functions";

/** DARB-level Google Business connection health + read-only discovery (admin only). */
export default function GoogleBusinessConnectionPanel() {
  const { t } = useTranslation("dashboard");
  const fetchOverview = useServerFn(getGoogleBusinessOverview);
  const query = useQuery({
    queryKey: ["google-business-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const data = query.data;
  const status = query.isError ? "error" : data?.status;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{t("admin.googleConnection.title")}</CardTitle>
          {data?.checkedAt ? (
            <p className="text-xs text-muted-foreground">
              {t("admin.googleConnection.checkedAt", {
                time: new Date(data.checkedAt).toLocaleString("en-US"),
              })}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {status ? (
            <Badge variant={status === "connected" ? "default" : status === "error" ? "destructive" : "outline"}>
              {t(`admin.googleConnection.status.${status}`)}
            </Badge>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`me-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} />
            {t("admin.googleConnection.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {query.isLoading ? <p className="text-muted-foreground">{t("admin.googleConnection.loading")}</p> : null}
        {query.isError ? (
          <p className="text-destructive">{(query.error as Error)?.message || t("admin.googleConnection.loadError")}</p>
        ) : null}
        {data?.status === "not_linked" ? (
          <p className="text-muted-foreground">{t("admin.googleConnection.notLinked")}</p>
        ) : null}
        {data?.status === "error" ? (
          <p className="text-destructive">
            {t(`admin.googleConnection.errors.${data.errorCode ?? "upstream"}`)}
            {data.errorMessage ? ` (${data.errorMessage})` : ""}
          </p>
        ) : null}
        {data?.status === "connected" && data.accounts.length === 0 ? (
          <p className="text-muted-foreground">{t("admin.googleConnection.noAccounts")}</p>
        ) : null}
        {data?.accounts.map((account) => (
          <div key={account.name} className="min-w-0 rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{account.accountName || account.name}</span>
              {account.type ? <Badge variant="outline">{account.type}</Badge> : null}
              {account.verificationState ? <Badge variant="secondary">{account.verificationState}</Badge> : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("admin.googleConnection.locationCount", { count: account.locations.length })}
            </p>
            {account.locationsError ? (
              <p className="mt-1 text-xs text-destructive">{account.locationsError}</p>
            ) : null}
            <ul className="mt-2 space-y-1">
              {account.locations.map((loc) => (
                <li key={loc.name} className="flex min-w-0 items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate">{loc.title || loc.name}</span>
                    {loc.address ? <span className="block truncate text-xs text-muted-foreground">{loc.address}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
