import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, UserPlus } from "lucide-react";

interface AppRow {
  id: string;
  recruit_code: string;
  master_partner_id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string | null;
  social_link: string | null;
  note: string | null;
  status: string;
  created_at: string;
  master?: { full_name: string | null } | null;
}

/** Admin review of partner applications that arrived through a master partner's recruit link. */
export default function RecruitApplicationsPanel() {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const locale = i18n.language === "ar" ? "ar" : "en-US";
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("partner_recruit_applications")
      .select("*, master:profiles!partner_recruit_applications_master_partner_id_fkey(full_name)")
      .order("created_at", { ascending: false });
    setRows((data || []) as AppRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (row: AppRow) => {
    setBusy(row.id);
    const { data, error } = await supabase.functions.invoke("create-team-member", {
      body: {
        email: row.email,
        full_name: row.full_name,
        role: "social_media_partner",
        master_partner_id: row.master_partner_id,
      },
    });
    if (error || !(data as any)?.user_id) {
      setBusy(null);
      toast({
        variant: "destructive",
        title: t("common.actionFailed", "Action failed"),
        description: (data as any)?.error || error?.message || "Failed",
      });
      return;
    }
    const { error: linkError } = await (supabase as any).rpc("approve_recruit_application", {
      p_id: row.id,
      p_user_id: (data as any).user_id,
    });
    setBusy(null);
    if (linkError) {
      toast({ variant: "destructive", title: t("common.actionFailed", "Action failed"), description: linkError.message });
      return;
    }
    toast({
      title: t("admin.recruit.approved", "Partner approved"),
      description: `${row.email} · ${(data as any).temp_password}`,
    });
    load();
  };

  const reject = async (row: AppRow) => {
    setBusy(row.id);
    const { error } = await (supabase as any).rpc("reject_recruit_application", { p_id: row.id });
    setBusy(null);
    if (error) {
      toast({ variant: "destructive", title: t("common.actionFailed", "Action failed"), description: error.message });
      return;
    }
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-600" />
          {t("admin.recruit.title", "Master partner recruits")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{r.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.email} · {r.phone}
                  {r.city ? ` · ${r.city}` : ""}
                </p>
                <p className="text-xs">
                  {t("admin.recruit.recruitedBy", "Recruited by")}:{" "}
                  <span className="font-semibold">{r.master?.full_name ?? "—"}</span>{" "}
                  <span className="text-muted-foreground">({r.recruit_code})</span>
                </p>
                {r.note && <p className="text-xs text-muted-foreground italic">“{r.note}”</p>}
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString(locale)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "outline"}>
                  {t(`admin.recruit.status.${r.status}`, { defaultValue: r.status })}
                </Badge>
                {r.status === "pending" && (
                  <>
                    <Button size="sm" disabled={busy === r.id} onClick={() => approve(r)} className="gap-1.5">
                      {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                      {t("admin.recruit.approve", "Approve")}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => reject(r)}>
                      {t("admin.recruit.reject", "Reject")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
