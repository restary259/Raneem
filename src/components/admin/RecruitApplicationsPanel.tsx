import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { readFunctionError } from "@/lib/functionError";
import { Loader2, Mail, UserPlus } from "lucide-react";

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

interface Props {
  /** Text filter coming from the page toolbar. */
  search?: string;
  /** Reports row counts so the page can show a tab badge. */
  onCount?: (total: number, pending: number) => void;
}

/** Admin review of partner applications that arrived through a master partner's recruit link. */
export default function RecruitApplicationsPanel({ search = "", onCount }: Props) {
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
    const next = (data || []) as AppRow[];
    setRows(next);
    setLoading(false);
    onCount?.(next.length, next.filter((r) => r.status === "pending").length);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.full_name, r.email, r.phone, r.recruit_code].some((v) =>
        (v || "").toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

  const approve = async (row: AppRow) => {
    setBusy(row.id);
    const { data, error } = await supabase.functions.invoke("approve-partner-recruit", {
      body: { application_id: row.id, action: "approve" },
    });
    setBusy(null);
    if (error || !(data as any)?.success) {
      const message = (data as any)?.error || (await readFunctionError(error));
      toast({
        variant: "destructive",
        title: t("common.actionFailed", "Action failed"),
        description: message,
      });
      load();
      return;
    }
    toast({
      title: t("admin.recruit.approved", "Partner approved"),
      description: (data as any).emailed
        ? t("admin.recruit.inviteSent", "Activation email sent to {{email}}", { email: row.email })
        : t("admin.recruit.inviteFailed", "Account created, but the activation email failed. Use “Resend invite”."),
      variant: (data as any).emailed ? undefined : "destructive",
    });
    load();
  };

  const resendInvite = async (row: AppRow) => {
    setBusy(row.id);
    const { data, error } = await supabase.functions.invoke("approve-partner-recruit", {
      body: { application_id: row.id, action: "resend_invite" },
    });
    setBusy(null);
    if (error || !(data as any)?.emailed) {
      toast({
        variant: "destructive",
        title: t("common.actionFailed", "Action failed"),
        description: (data as any)?.error || (await readFunctionError(error)),
      });
      return;
    }
    toast({
      title: t("admin.recruit.inviteSent", "Activation email sent to {{email}}", { email: row.email }),
    });
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
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <p className="p-10 text-center text-muted-foreground">
        {t("admin.recruit.empty", "No recruit applications")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((r) => (
        <Card key={r.id} className={r.status === "pending" ? "border-primary/40 bg-muted/30" : ""}>
          <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">{r.full_name}</p>
              <p className="text-xs text-muted-foreground break-words">
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
            <div className="flex items-center gap-2 ms-auto">
              <Badge variant={r.status === "pending" ? "destructive" : r.status === "approved" ? "default" : "secondary"}>
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
              {r.status === "approved" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.id}
                  onClick={() => resendInvite(r)}
                  className="gap-1.5"
                >
                  {busy === r.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  {t("admin.recruit.resendInvite", "Resend invite")}
                </Button>
              )}

            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
