import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Megaphone, TrendingUp, Award } from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";

interface NetworkRow {
  partner_id: string;
  full_name: string;
  email: string;
  city: string | null;
  referral_code: string | null;
  joined_at: string;
  status: string;
  students_count: number;
  paid_cases: number;
  override_earned: number;
}

const fmt = (n: number) => `₪${Number(n || 0).toLocaleString("en-US")}`;

/** Agent overview: network KPIs + lifetime override earnings (zero until the
 *  commission wiring mints the first agent_override reward). */
export default function AgentOverviewPage() {
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [rows, setRows] = useState<NetworkRow[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (uid: string) => {
    const [profRes, netRes, settingsRes, overrideRes] = await Promise.all([
      (supabase as any).from("profiles").select("full_name").eq("id", uid).maybeSingle(),
      (supabase as any).rpc("get_my_agent_network"),
      (supabase as any).from("platform_settings").select("agent_commission_rate").limit(1).maybeSingle(),
      (supabase as any)
        .from("agent_commission_overrides")
        .select("commission_amount")
        .eq("agent_id", uid)
        .maybeSingle(),
    ]);
    setProfile(profRes.data ?? null);
    setRows((netRes.data ?? []) as NetworkRow[]);
    const global = Number(settingsRes.data?.agent_commission_rate ?? 0);
    setCommissionRate(Number(overrideRes.data?.commission_amount ?? global));
    setIsLoading(false);
  }, []);

  const userId = useAuthedUserId(load);
  useRealtimeSubscription("rewards", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("profiles", () => { if (userId) load(userId); }, !!userId);

  if (!userId || isLoading) return <DashboardLoading />;

  const totalOverride = rows.reduce((s, r) => s + Number(r.override_earned || 0), 0);
  const totalStudents = rows.reduce((s, r) => s + Number(r.students_count || 0), 0);
  const totalPaid = rows.reduce((s, r) => s + Number(r.paid_cases || 0), 0);

  const kpis = [
    { label: t("agent.recruitedPartners", "Recruited partners & ambassadors"), value: rows.length, icon: Users, color: "text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15" },
    { label: t("agent.networkStudents", "Network students"), value: totalStudents, icon: Megaphone, color: "text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-500/15" },
    { label: t("agent.paidCases", "Paid cases"), value: totalPaid, icon: Award, color: "text-teal-600 bg-teal-50 dark:text-teal-300 dark:bg-teal-500/15" },
    { label: t("agent.overrideEarned", "Override earned"), value: fmt(totalOverride), icon: TrendingUp, color: "text-primary bg-primary/10" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("agent.welcome", "Welcome")}
          {profile?.full_name ? `, ${profile.full_name}` : ""}! 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("agent.subtitle", "Agent dashboard")}</p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-foreground">{t("agent.perRecruitRate", "Per-recruit rate")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("agent.rateHint", "Flat commission carved from the partner pool when a recruit's student case is paid.")}
          </p>
        </div>
        <p className="text-3xl sm:text-4xl font-black text-primary truncate min-w-0 break-all">{fmt(commissionRate)}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border">
            <CardContent className="p-4">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5 ${kpi.color}`}>
                <kpi.icon className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold text-foreground">{typeof kpi.value === "number" ? kpi.value.toLocaleString("en-US") : kpi.value}</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
