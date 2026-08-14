import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMasterPartner } from "@/hooks/useIsMasterPartner";
import { useDirection } from "@/hooks/useDirection";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LoadingState, usePagination, TablePagination } from "@/components/shell";
import RateOfferDialog from "@/components/partner/RateOfferDialog";
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
  const { isMaster, loading: masterLoading } = useIsMasterPartner();
  const { toast } = useToast();
  const locale = i18n.language === "ar" ? "ar" : "en-US";

  const [rows, setRows] = useState<NetworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [sending, setSending] = useState(false);
  const [splits, setSplits] = useState<Record<string, { pool: number; partner: number; master: number }>>({});
  const [offers, setOffers] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: network }, { data: link }, { data: offerRows }] = await Promise.all([
      (supabase as any).rpc("get_my_network"),
      (supabase as any).rpc("ensure_master_recruit_link"),
      (supabase as any).rpc("get_my_rate_offers"),
    ]);
    const list = (network || []) as NetworkRow[];
    setRows(list);
    setInviteCode((Array.isArray(link) ? link[0]?.code : null) ?? null);
    setOffers((offerRows || []) as any[]);

    const entries = await Promise.all(
      list.map(async (r) => {
        const { data } = await (supabase as any).rpc("get_effective_partner_split", { p_partner_id: r.partner_id });
        const s = Array.isArray(data) ? data[0] : null;
        return [
          r.partner_id,
          {
            pool: Number(s?.pool_amount ?? 0),
            partner: Number(s?.partner_amount ?? 0),
            master: Number(s?.master_share ?? 0),
          },
        ] as const;
      }),
    );
    setSplits(Object.fromEntries(entries));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const inviteUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : "";


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
      toast({ variant: "destructive", title: t("common.error"), description: t("common.actionFailed") });
      return;
    }
    setAnnouncement("");
    toast({ title: t("master.announceSent", "Announcement sent"), description: `${data ?? 0}` });
  };

  if (masterLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
        <LoadingState variant="rows" rows={4} label={t("common.loading", "Loading")} />
      </div>
    );
  }
  if (!isMaster) return <Navigate to="/partner" replace />;
  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
        <LoadingState variant="table" rows={6} label={t("common.loading", "Loading")} />
      </div>
    );
  }

  const pagination = usePagination(rows, 25);

  const totalOverride = rows.reduce((s, r) => s + Number(r.override_earned || 0), 0);
  const totalStudents = rows.reduce((s, r) => s + Number(r.students_count || 0), 0);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 text-[hsl(var(--status-payment))]" />
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
                {copied ? <Check className="h-4 w-4 text-[hsl(var(--status-enrolled))]" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("master.inviteMissing", "No recruiting link yet.")}</p>
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
              {pagination.items.map((r) => {
                const s = splits[r.partner_id];
                const pending = offers.find(
                  (o) => o.partner_id === r.partner_id && o.status === "pending",
                );
                return (
                <div key={r.partner_id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.city ? `${r.city} · ` : ""}{new Date(r.joined_at).toLocaleDateString(locale)}
                    </p>
                    {s && (
                      <p className="text-xs mt-1">
                        {t("master.agreedRate", "Agreed rate")}:{" "}
                        <span className="font-semibold">{fmt(s.partner)}</span>
                        {s.master > 0 && (
                          <span className="text-muted-foreground">
                            {" "}· {t("master.yourShare", "your share")} {fmt(s.master)}
                          </span>
                        )}
                      </p>
                    )}
                    {pending && (
                      <p className="text-xs text-[hsl(var(--status-payment))] mt-0.5">
                        {t("master.offerPending", "Offer pending: {{amount}}", { amount: fmt(pending.partner_amount) })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>
                      {t(`master.status.${r.status}`, { defaultValue: r.status })}
                    </Badge>
                    <span>{t("master.colStudents", "Students")}: {Number(r.students_count).toLocaleString("en-US")}</span>
                    <span className="font-semibold">{fmt(r.override_earned)}</span>
                    {s && (
                      <RateOfferDialog
                        partnerId={r.partner_id}
                        partnerName={r.full_name}
                        poolAmount={s.pool}
                        currentPartnerAmount={s.partner}
                        onSent={load}
                      />
                    )}
                  </div>
                </div>
                );
              })}

            </div>
          )}
          {rows.length > 0 && <TablePagination pagination={pagination} />}
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
