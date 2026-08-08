import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDirection } from "@/hooks/useDirection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { BarChart2 } from "lucide-react";

interface NetworkRow {
  partner_id: string;
  full_name: string;
  students_count: number;
  paid_cases: number;
  override_earned: number;
}

const fmt = (n: number) => `₪${Number(n || 0).toLocaleString("en-US")}`;

/** Per-partner performance across a master partner's recruited network. */
export default function PartnerPerformancePage() {
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { user } = useAuth();
  const [rows, setRows] = useState<NetworkRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any).rpc("get_my_network");
    setRows((data || []) as NetworkRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <DashboardLoading />;

  const sorted = [...rows].sort((a, b) => Number(b.override_earned) - Number(a.override_earned));
  const maxStudents = Math.max(1, ...sorted.map((r) => Number(r.students_count || 0)));

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BarChart2 className="h-6 w-6 text-primary" />
        {t("master.performanceTitle", "Network performance")}
      </h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("master.perPartner", "Per partner")}</CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("master.noPartners", "No recruited partners yet")}
            </p>
          ) : (
            <div className="space-y-4">
              {sorted.map((r) => (
                <div key={r.partner_id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium truncate">{r.full_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("master.colStudents", "Students")}: {Number(r.students_count).toLocaleString("en-US")} ·{" "}
                      {t("master.colPaid", "Paid cases")}: {Number(r.paid_cases).toLocaleString("en-US")} ·{" "}
                      <span className="font-semibold text-foreground">{fmt(r.override_earned)}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(Number(r.students_count || 0) / maxStudents) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
