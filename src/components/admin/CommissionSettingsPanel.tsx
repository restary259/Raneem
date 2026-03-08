import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Users, Settings2, Eye, Save, Loader2, Percent, UserCog, RefreshCw, Trash2 } from "lucide-react";

interface PlatformSettings {
  id: string;
  partner_commission_rate: number;
  team_member_commission_rate: number;
  partner_dashboard_show_all_cases: boolean;
}

interface PartnerOverride {
  id: string;
  partner_id: string;
  commission_amount: number;
  notes: string | null;
  show_all_cases: boolean | null;
  partner_name?: string;
}

interface TeamOverride {
  id: string;
  team_member_id: string;
  commission_amount: number;
  notes: string | null;
  member_name?: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

export default function CommissionSettingsPanel() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [partners, setPartners] = useState<UserProfile[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [partnerOverrides, setPartnerOverrides] = useState<PartnerOverride[]>([]);
  const [teamOverrides, setTeamOverrides] = useState<TeamOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newPartnerOverride, setNewPartnerOverride] = useState({
    partner_id: "",
    amount: "",
    notes: "",
    show_all_cases: null as boolean | null,
  });
  const [newTeamOverride, setNewTeamOverride] = useState({ team_member_id: "", amount: "", notes: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settRes, partnerRolesRes, teamRolesRes, partnerOvRes, teamOvRes] = await Promise.all([
        supabase.from("platform_settings" as any).select("*").limit(1).single(),
        supabase.from("user_roles" as any).select("user_id").eq("role", "social_media_partner"),
        supabase.from("user_roles" as any).select("user_id").eq("role", "team_member"),
        supabase.from("partner_commission_overrides" as any).select("*"),
        supabase.from("team_member_commission_overrides" as any).select("*"),
      ]);

      if (settRes.data) setSettings(settRes.data as unknown as PlatformSettings);

      const partnerIds = (partnerRolesRes.data || []).map((r: any) => r.user_id);
      const teamIds = (teamRolesRes.data || []).map((r: any) => r.user_id);

      const [profPartners, profTeam] = await Promise.all([
        partnerIds.length ? supabase.from("profiles" as any).select("id,full_name,email").in("id", partnerIds) : { data: [] },
        teamIds.length ? supabase.from("profiles" as any).select("id,full_name,email").in("id", teamIds) : { data: [] },
      ]);

      setPartners((profPartners.data || []) as UserProfile[]);
      setTeamMembers((profTeam.data || []) as UserProfile[]);

      const pOvData = (partnerOvRes.data || []) as unknown as PartnerOverride[];
      const tOvData = (teamOvRes.data || []) as unknown as TeamOverride[];

      setPartnerOverrides(
        pOvData.map((ov) => ({
          ...ov,
          partner_name: (profPartners.data as any[])?.find((p) => p.id === ov.partner_id)?.full_name ?? ov.partner_id.slice(0, 8),
        })),
      );
      setTeamOverrides(
        tOvData.map((ov) => ({
          ...ov,
          member_name: (profTeam.data as any[])?.find((p) => p.id === ov.team_member_id)?.full_name ?? ov.team_member_id.slice(0, 8),
        })),
      );
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveGlobalSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("platform_settings")
        .update({
          partner_commission_rate: settings.partner_commission_rate,
          team_member_commission_rate: settings.team_member_commission_rate,
          partner_dashboard_show_all_cases: settings.partner_dashboard_show_all_cases,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
      if (error) throw error;
      toast({ description: t("admin.commission.saveCommissionSettings") + " ✓" });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const addPartnerOverride = async () => {
    if (!newPartnerOverride.partner_id || !newPartnerOverride.amount) return;
    try {
      const { error } = await (supabase as any).from("partner_commission_overrides").upsert(
        {
          partner_id: newPartnerOverride.partner_id,
          commission_amount: parseInt(newPartnerOverride.amount),
          notes: newPartnerOverride.notes || null,
          show_all_cases: newPartnerOverride.show_all_cases,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "partner_id" },
      );
      if (error) throw error;
      setNewPartnerOverride({ partner_id: "", amount: "", notes: "", show_all_cases: null });
      toast({ description: t("admin.commission.savePartnerOverride") + " ✓" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const addTeamOverride = async () => {
    if (!newTeamOverride.team_member_id || !newTeamOverride.amount) return;
    try {
      const { error } = await (supabase as any).from("team_member_commission_overrides").upsert(
        {
          team_member_id: newTeamOverride.team_member_id,
          commission_amount: parseInt(newTeamOverride.amount),
          notes: newTeamOverride.notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "team_member_id" },
      );
      if (error) throw error;
      setNewTeamOverride({ team_member_id: "", amount: "" , notes: "" });
      toast({ description: t("admin.commission.saveTeamOverride") + " ✓" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const deletePartnerOverride = async (id: string) => {
    await (supabase as any).from("partner_commission_overrides").delete().eq("id", id);
    fetchData();
  };

  const deleteTeamOverride = async (id: string) => {
    await (supabase as any).from("team_member_commission_overrides").delete().eq("id", id);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Commission Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-primary" />
            {t("admin.commission.globalRates")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {t("admin.commission.partnerCommission")}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                <Input
                  type="number"
                  min="0"
                  className="pl-7"
                  value={settings?.partner_commission_rate ?? 500}
                  onChange={(e) =>
                    setSettings((s) => (s ? { ...s, partner_commission_rate: parseInt(e.target.value) || 0 } : s))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.commission.partnerCommissionDesc")}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <UserCog className="h-3.5 w-3.5" />
                {t("admin.commission.teamMemberCommission")}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                <Input
                  type="number"
                  min="0"
                  className="pl-7"
                  value={settings?.team_member_commission_rate ?? 100}
                  onChange={(e) =>
                    setSettings((s) => (s ? { ...s, team_member_commission_rate: parseInt(e.target.value) || 0 } : s))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.commission.teamMemberCommissionDesc")}
              </p>
            </div>
          </div>

          {settings && (
            <div className="bg-muted/40 rounded-xl p-4 border border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                {t("admin.commission.exampleCalc")}
              </p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t("admin.commission.partner")}</p>
                  <p className="font-bold text-primary">₪{settings.partner_commission_rate.toLocaleString('en-US')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("admin.commission.teamMember")}</p>
                  <p className="font-bold text-purple-600">₪{settings.team_member_commission_rate.toLocaleString('en-US')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("admin.commission.platformRevenue")}</p>
                  <p className="font-bold text-emerald-600">
                    ₪{Math.max(0, 2000 - settings.partner_commission_rate - settings.team_member_commission_rate).toLocaleString('en-US')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Partner Dashboard Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-primary" />
            {t("admin.commission.partnerDashboardVisibility")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-muted/20">
            <div>
              <p className="text-sm font-semibold">{t("admin.commission.showAllCasesToPartners")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("admin.commission.showAllCasesDesc")}
              </p>
            </div>
            <Switch
              checked={settings?.partner_dashboard_show_all_cases ?? false}
              onCheckedChange={(v) => setSettings((s) => (s ? { ...s, partner_dashboard_show_all_cases: v } : s))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Global Settings */}
      <Button onClick={saveGlobalSettings} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        {saving ? t("admin.commission.saving") : t("admin.commission.saveCommissionSettings")}
      </Button>

      {/* Per-Partner Overrides */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="h-4 w-4 text-primary" />
              {t("admin.commission.partnerOverrides")}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {partnerOverrides.length > 0 && (
            <div className="space-y-2">
              {partnerOverrides.map((ov) => (
                <div key={ov.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{ov.partner_name}</p>
                    {ov.notes && <p className="text-xs text-muted-foreground">{ov.notes}</p>}
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    ₪{ov.commission_amount.toLocaleString('en-US')}
                  </Badge>
                  <Badge
                    variant={ov.show_all_cases === true ? "default" : ov.show_all_cases === false ? "outline" : "secondary"}
                    className="text-xs whitespace-nowrap"
                  >
                    {ov.show_all_cases === true
                      ? t("admin.commission.badgeAllCases")
                      : ov.show_all_cases === false
                        ? t("admin.commission.badgeApplyOnly")
                        : t("admin.commission.badgeGlobalDefault")}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePartnerOverride(ov.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new override */}
          <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">{t("admin.commission.addUpdateOverride")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select
                value={newPartnerOverride.partner_id}
                onValueChange={(v) => setNewPartnerOverride((p) => ({ ...p, partner_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.commission.selectPartner")} />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                <Input
                  type="number"
                  min="0"
                  placeholder={t("admin.commission.amountPlaceholder")}
                  className="pl-7"
                  value={newPartnerOverride.amount}
                  onChange={(e) => setNewPartnerOverride((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <Input
                placeholder={t("admin.commission.notesOptional")}
                value={newPartnerOverride.notes}
                onChange={(e) => setNewPartnerOverride((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>

            {/* Visibility override */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> {t("admin.commission.caseVisibilityLabel")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "null", label: t("admin.commission.visGlobalDefault"), desc: t("admin.commission.visGlobalDefaultDesc") },
                  { value: "true", label: t("admin.commission.visAllCases"), desc: t("admin.commission.visAllCasesDesc") },
                  { value: "false", label: t("admin.commission.visApplyOnly"), desc: t("admin.commission.visApplyOnlyDesc") },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setNewPartnerOverride((p) => ({
                        ...p,
                        show_all_cases: opt.value === "null" ? null : opt.value === "true",
                      }))
                    }
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                      String(newPartnerOverride.show_all_cases) === opt.value
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="font-semibold">{opt.label}</p>
                    <p className="opacity-70 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button
              size="sm"
              onClick={addPartnerOverride}
              disabled={!newPartnerOverride.partner_id || !newPartnerOverride.amount}
            >
              {t("admin.commission.savePartnerOverride")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-Team-Member Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" />
            {t("admin.commission.teamOverridesTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {teamOverrides.length > 0 && (
            <div className="space-y-2">
              {teamOverrides.map((ov) => (
                <div key={ov.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{ov.member_name}</p>
                    {ov.notes && <p className="text-xs text-muted-foreground">{ov.notes}</p>}
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    ₪{ov.commission_amount.toLocaleString('en-US')}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTeamOverride(ov.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new override */}
          <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">{t("admin.commission.addUpdateOverride")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select
                value={newTeamOverride.team_member_id}
                onValueChange={(v) => setNewTeamOverride((p) => ({ ...p, team_member_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.commission.selectTeamMember")} />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                <Input
                  type="number"
                  min="0"
                  placeholder={t("admin.commission.amountPlaceholder")}
                  className="pl-7"
                  value={newTeamOverride.amount}
                  onChange={(e) => setNewTeamOverride((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <Input
                placeholder={t("admin.commission.notesOptional")}
                value={newTeamOverride.notes}
                onChange={(e) => setNewTeamOverride((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <Button
              size="sm"
              onClick={addTeamOverride}
              disabled={!newTeamOverride.team_member_id || !newTeamOverride.amount}
            >
              {t("admin.commission.saveTeamOverride")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
