import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Users, Copy, Check, Link2, Send, Loader2 } from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { identityConflictMessage } from "@/lib/identityConflict";
import { readFunctionError, readFunctionErrorBody } from "@/lib/functionError";

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
  /** Effective per-recruit override returned by the bulk get_my_agent_network
   *  RPC (absent while the deployed RPC is the old 10-column version). */
  agent_amount?: number;
}

const fmt = (n: number) => `₪${Number(n || 0).toLocaleString("en-US")}`;

/** Agent network: the partners/ambassadors this agent recruited, the
 *  per-recruit override, and the agent's /join/AG-XXXX recruit link
 *  (mirrors the master-partner recruit link). Approved recruits are linked to
 *  the agent (profiles.agent_id) at activation via accept-invitation.
 *  Agents granted agent_can_invite_directly can also invite partners &
 *  ambassadors by email straight from here (agent-invite-recruit). */
export default function AgentNetworkPage() {
  const { t, i18n } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { toast } = useToast();
  const locale = i18n.language === "ar" ? "ar" : "en-US";
  const [rows, setRows] = useState<NetworkRow[]>([]);
  const [splits, setSplits] = useState<Record<string, number>>({});
  const [splitsLoaded, setSplitsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canInvite, setCanInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ full_name: "", email: "", role: "social_media_partner" });
  const [inviting, setInviting] = useState(false);
  const inviteEmail = inviteForm.email.trim().toLowerCase();
  const inviteEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail);
  const inviteFormValid = inviteForm.full_name.trim().length > 0 && inviteEmailValid;

  // Per-recruit override rates are fetched in the background so the recruit list
  // renders immediately. The bulk get_my_agent_network RPC now returns
  // agent_amount per row (ONE query, no N+1), so this only runs for rows that
  // lack it — i.e. while the deployed RPC is still the old 10-column version.
  const loadSplits = useCallback(async (uid: string, list: NetworkRow[]) => {
    if (list.length === 0) {
      setSplitsLoaded(true);
      return;
    }
    const entries = await Promise.all(
      list.map(async (r) => {
        try {
          const { data: s } = await (supabase as any).rpc("get_effective_agent_split", {
            p_agent_id: uid,
            p_recruited_partner_id: r.partner_id,
          });
          const row = Array.isArray(s) ? s[0] : null;
          return [r.partner_id, Number(row?.agent_amount ?? 0)] as const;
        } catch {
          return [r.partner_id, 0] as const;
        }
      }),
    );
    setSplits(Object.fromEntries(entries));
    setSplitsLoaded(true);
  }, []);

  const load = useCallback(async (uid: string) => {
    const [netRes, linkRes, profileRes] = await Promise.all([
      (supabase as any).rpc("get_my_agent_network"),
      (supabase as any).rpc("ensure_agent_recruit_link"),
      (supabase as any).from("profiles").select("agent_can_invite_directly").eq("id", uid).maybeSingle(),
    ]);
    const list = (netRes.data ?? []) as NetworkRow[];
    setRows(list);
    const linkRow = Array.isArray(linkRes.data) ? linkRes.data[0] : linkRes.data;
    setInviteCode(linkRow?.code ?? null);
    setCanInvite(profileRes.data?.agent_can_invite_directly === true);
    setLoading(false);
    // Rows carrying agent_amount render immediately; the rest (old RPC) fall
    // back to background per-recruit splits.
    void loadSplits(uid, list.filter((r) => r.agent_amount == null));
  }, [loadSplits]);

  const userId = useAuthedUserId(load);
  useRealtimeSubscription("profiles", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("rewards", () => { if (userId) load(userId); }, !!userId);

  const sendInvite = async () => {
    const name = inviteForm.full_name.trim();
    const email = inviteForm.email.trim().toLowerCase();
    if (!name || !email) {
      toast({ variant: "destructive", description: t("agent.inviteRequired", "Name and email are required") });
      return;
    }
    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke("agent-invite-recruit", {
        body: { email, full_name: name, role: inviteForm.role },
      });
      if (error) {
        const body = await readFunctionErrorBody(error);
        const conflict = identityConflictMessage(body as any, t);
        if (conflict) throw new Error(conflict);
        throw new Error(await readFunctionError(error));
      }
      toast({ description: t("agent.inviteSent", "Invitation sent") });
      setInviteForm({ full_name: "", email: "", role: "social_media_partner" });
      if (userId) await load(userId);
    } catch (err: any) {
      toast({ variant: "destructive", description: err?.message ?? t("common.actionFailed", "Something went wrong. Please try again or contact support.") });
    } finally {
      setInviting(false);
    }
  };

  if (!userId || loading) return <DashboardLoading />;

  const totalOverride = rows.reduce((s, r) => s + Number(r.override_earned || 0), 0);
  const totalStudents = rows.reduce((s, r) => s + Number(r.students_count || 0), 0);
  const inviteUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : "";

  const copy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard may be unavailable; the input stays selectable */ }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 text-amber-600" />
          {t("agent.networkTitle", "My network")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("agent.networkSubtitle", "Partners & ambassadors you recruited and the override they generate.")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t("agent.kpiPartners", "Recruited")}</p>
          <p className="text-2xl font-bold">{rows.length.toLocaleString("en-US")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t("agent.kpiStudents", "Network students")}</p>
          <p className="text-2xl font-bold">{totalStudents.toLocaleString("en-US")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t("agent.kpiOverride", "Override earned")}</p>
          <p className="text-2xl font-bold">{fmt(totalOverride)}</p>
        </CardContent></Card>
      </div>

      {canInvite && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              {t("agent.directInviteTitle", "Invite a partner / ambassador")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("agent.directInviteHint", "Send an activation link directly. The invited person signs up with this email and joins your network as soon as they activate their account.")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("agent.inviteFullName", "Full name")}</Label>
                <Input
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder={t("agent.inviteFullNamePlaceholder", "e.g. Sara Khalil")}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("agent.inviteEmail", "Email")}</Label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="name@example.com"
                  dir="ltr"
                  maxLength={255}
                  className={inviteEmail && !inviteEmailValid ? "border-destructive focus-visible:ring-destructive" : undefined}
                  aria-invalid={!!inviteEmail && !inviteEmailValid}
                />
                {inviteEmail && !inviteEmailValid && (
                  <p className="text-xs text-destructive">{t("agent.inviteEmailInvalid", "Enter a valid email address")}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("agent.inviteRole", "Role")}</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(v) => setInviteForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="social_media_partner">{t("admin.team.partnerRole", "Partner")}</SelectItem>
                  <SelectItem value="ambassador">{t("admin.team.ambassadorRole", "Ambassador")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={sendInvite} disabled={inviting || !inviteFormValid} className="gap-2">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {inviting ? t("agent.inviteSending", "Sending...") : t("agent.sendInvite", "Send invitation")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            {t("agent.inviteTitle", "Recruiting link")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("agent.inviteHint", "Share this link with partners or ambassadors you want to recruit. Applications through it are attached to your network after Darb approves them.")}
          </p>
          {inviteCode ? (
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} className="text-xs" dir="ltr" />
              <Button variant="outline" size="icon" onClick={copy} aria-label={t("common.copy", "Copy")}>
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("agent.inviteMissing", "No recruiting link yet.")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t("agent.partnersTitle", "Recruited partners & ambassadors")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("agent.noPartners", "No recruited partners or ambassadors yet")}
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
                    <p className="text-xs mt-1">
                      {t("agent.agreedRate", "Override rate")}:{" "}
                      {r.agent_amount != null || splitsLoaded ? (
                        <span className="font-semibold">{fmt(r.agent_amount ?? splits[r.partner_id] ?? 0)}</span>
                      ) : (
                        <span className="inline-block h-3 w-12 animate-pulse rounded bg-muted align-middle" />
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
                    <span>{t("agent.colStudents", "Students")}: {Number(r.students_count).toLocaleString("en-US")}</span>
                    <span className="font-semibold">{fmt(r.override_earned)}</span>
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