import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDirection } from "@/hooks/useDirection";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { Crown, Copy, Check, Users, Megaphone } from "lucide-react";

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

/** Master partner network: recruits, their performance and the recruiting link. */
export default function PartnerNetworkPage() {
  const { t, i18n } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { user } = useAuth();
  const { toast } = useToast();
  const locale = i18n.language === "ar" ? "ar" : "en-US";

  const [rows, setRows] = useState<NetworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: network }, { data: links }] = await Promise.all([
      (supabase as any).rpc("get_my_network"),
      (supabase as any)
        .from("partner_links")
        .select("code, purpose, active")
        .eq("partner_id", user.id)
        .eq("purpose", "recruit")
        .eq("active", true)
        .limit(1),
    ]);
    setRows((network || []) as NetworkRow[]);
    setInviteCode(links?.[0]?.code ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const createInviteLink = async () => {
    if (!user) return;
    const code = `M${user.id.slice(0, 6).toUpperCase()}`;
    const { error } = await (supabase as any).from("partner_links").insert({
      partner_id: user.id,
      code,
      label: t("master.inviteLabel", "Recruit partners"),
      target_path: "/partnership",
      purpose: "recruit",
    });
    if (error) {
      toast({ variant: "destructive", title: t("common.actionFailed"), description: error.message });
      return;
    }
    setInviteCode(code);
  };

  const inviteUrl = inviteCode ? `${window.location.origin}/partnership?ref=${inviteCode}` : "";

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const announce = async () => {
    const body = announcement.trim();
    if (!body) return;
    setSending(true);
    const { data, error } = await (supabase as any).rpc("master_announce_to_network", { p_body: body });
    setSending(false);
    if (error) {
      toast({ variant: "destructive", title: t("common.actionFailed"), description: error.message });
      return;
    }
    setAnnouncement("");
    toast({ title: t("master.announceSent", "Announcement sent"), description: `${data ?? 0}` });
  };

  if (loading) return <DashboardLoading />;

  const totalOverride = rows.reduce((s, r) => s + Number(r.override_earned || 0), 0);
  const totalStudents = rows.reduce((s, r) => s + Number(r.students_count || 0), 0);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 text-amber-600" />
          {t("master.networkTitle", "My network")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("master.networkSubtitle", "Partners you recruited and the override they generate.")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t("master.kpiPartners", "Recruited partners")}</p>
          <p className="text-2xl font-bold">{rows.length.toLocaleString("en-US")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t("master.kpiStudents", "Network students")}</p>
          <p className="text-2xl font-bold">{totalStudents.toLocaleString("en-US")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t("master.kpiOverride", "Network override earned")}</p>
          <p className="text-2xl font-bold">{fmt(totalOverride)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("master.inviteTitle", "Recruiting link")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("master.inviteHint", "Share this link with partners you want to recruit. Applications through it are attached to your network after Darb approves them.")}
          </p>
          {inviteCode ? (
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} className="text-xs" />
              <Button variant="outline" size="icon" onClick={copy} aria-label={t("common.copy", "Copy")}>
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <Button onClick={createInviteLink}>{t("master.createInvite", "Create recruiting link")}</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t("master.partnersTitle", "Recruited partners")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("master.noPartners", "No recruited partners yet")}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r.partner_id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.city ? `${r.city} · ` : ""}{new Date(r.joined_at).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>
                      {t(`master.status.${r.status}`, { defaultValue: r.status })}
                    </Badge>
                    <span>{t("master.colStudents", "Students")}: {Number(r.students_count).toLocaleString("en-US")}</span>
                    <span className="font-semibold">{fmt(r.override_earned)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            {t("master.announceTitle", "Announce to my network")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={t("master.announcePlaceholder", "Write a short update for your partners…")}
          />
          <Button onClick={announce} disabled={sending || !announcement.trim() || rows.length === 0}>
            {t("master.announceSend", "Send announcement")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
