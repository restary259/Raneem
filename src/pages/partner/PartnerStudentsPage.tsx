import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Search } from "lucide-react";
import { LoadingState, usePagination, TablePagination, useDebouncedValue } from "@/components/shell";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { STATUS_COLORS } from "@/lib/caseStatus";
import {
  fetchPartnerVisibilityOverride,
  resolvePartnerVisibilityMode,
  resolveVisibilitySources,
  type ResolvedPartnerVisibilityMode,
} from "@/lib/partnerVisibility";

export default function PartnerStudentsPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [visibilityMode, setVisibilityMode] = useState<ResolvedPartnerVisibilityMode>('partner_sources');
  const { t, i18n } = useTranslation("dashboard");
  const { dir } = useDirection();
  const isAr = i18n.language === "ar";

  const load = useCallback(async (uid: string) => {
    const [settingsRes, overrideRes] = await Promise.all([
      (supabase as any)
        .from("platform_settings")
        .select("partner_dashboard_show_all_cases")
        .limit(1)
        .maybeSingle(),
      fetchPartnerVisibilityOverride(uid),
    ]);

    const globalShowAll = settingsRes.data?.partner_dashboard_show_all_cases ?? false;
    const override = overrideRes;
    const mode = resolvePartnerVisibilityMode(override, globalShowAll);
    const sources = resolveVisibilitySources(override, globalShowAll);
    setVisibilityMode(mode);

    // Cases are read through the partner reader so the row set and the reduced
    // column set are enforced server-side (no phone, no internal notes).
    const { data, error } = await (supabase as any).rpc("get_partner_pool_cases", {
      p_sources: sources,
    });
    if (error) console.error("cases fetch error:", error);
    setCases(data || []);
    setIsLoading(false);
  }, []);

  const userId = useAuthedUserId(load);

  // Real-time: refetch when cases or partner overrides change
  useRealtimeSubscription("cases", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("partner_commission_overrides", () => { if (userId) load(userId); }, !!userId);

  const statusLabel = (s: string) => {
    return t(`partner.status.${s}`, { defaultValue: s });
  };

  const firstNameOnly = (full: string) => full?.split(" ")[0] || "—";

  const filtered = useMemo(() => cases.filter((c) => {
    const matchSearch = !debouncedSearch || firstNameOnly(c.full_name).toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  }), [cases, debouncedSearch, statusFilter]);

  const pagination = usePagination(filtered, 25);

  const statuses = [...new Set(cases.map((c) => c.status))];

  if (!userId || isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
        <LoadingState variant="table" rows={6} label={t("common.loading", "Loading")} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          {t("partner.registeredStudents")}
          <span className="text-base font-normal text-muted-foreground">({cases.length})</span>
        </h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("partner.searchByFirstName")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
        >
          {t("partner.all")} ({cases.length})
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
          >
            {statusLabel(s)} ({cases.filter((c) => c.status === s).length})
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <p>{t("partner.noMatchingStudents")}</p>
            {visibilityMode === 'referral_only' && (
              <p className="mt-2 text-xs">
                {t('partner.visibility.referralOnlyHint', 'Referral-only mode: apply/contact cases are hidden.')}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>{t("partner.colName")}</span>
            <span>{t("partner.colDate")}</span>
            <span>{t("partner.colStage")}</span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-border bg-background">
            {pagination.items.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-3 items-center px-4 py-3 text-sm hover:bg-muted/30 transition-colors"
              >
                <span className="font-medium text-foreground">{firstNameOnly(c.full_name)}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(c.created_at).toLocaleDateString('en-US')}
                </span>
                <Badge className={`text-xs w-fit ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>
                  {statusLabel(c.status)}
                </Badge>
              </div>
            ))}
          </div>
          <TablePagination pagination={pagination} />
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {t("partner.privacyNote")}
      </p>
    </div>
  );
}
