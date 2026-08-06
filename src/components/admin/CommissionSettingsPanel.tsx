import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Settings2, Eye, Loader2, Percent, UserCog, RefreshCw, Trash2, Info } from "lucide-react";

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

// Visibility mapping:
// true  → All Cases
// false → Apply / Contact Only
// null  → Referral Cases Only
const VISIBILITY_KEYS = [
  { value: "true", key: "all", badgeVariant: "default" as const },
  { value: "false", key: "applyContact", badgeVariant: "outline" as const },
  { value: "null", key: "referral", badgeVariant: "secondary" as const },
] as const;

function visibilityKey(val: boolean | null): "all" | "applyContact" | "referral" {
  if (val === true) return "all";
  if (val === false) return "applyContact";
  return "referral";
}

function visibilityBadgeVariant(val: boolean | null): "default" | "outline" | "secondary" {
  if (val === true) return "default";
  if (val === false) return "outline";
  return "secondary";
}


export default function CommissionSettingsPanel() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [partners, setPartners] = useState<UserProfile[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [partnerOverrides, setPartnerOverrides] = useState<PartnerOverride[]>([]);
  const [teamOverrides, setTeamOverrides] = useState<TeamOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const [newPartnerOverride, setNewPartnerOverride] = useState({
    partner_id: "",
    amount: "",
    notes: "",
    show_all_cases: null as boolean | null,
  });
  const [newTeamOverride, setNewTeamOverride] = useState({ team_member_id: "", amount: "", notes: "" });

  // Global flat defaults (ILS per enrolled student) used when no per-person override exists.
  const [globals, setGlobals] = useState({ id: "", partner: 500, ambassador: 300, team: 100 });
  const [savingGlobals, setSavingGlobals] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [partnerRolesRes, teamRolesRes, partnerOvRes, teamOvRes] = await Promise.all([
        supabase.from("user_roles" as any).select("user_id").in("role", ["social_media_partner", "ambassador"]),
        supabase.from("user_roles" as any).select("user_id").eq("role", "team_member"),
        supabase.from("partner_commission_overrides" as any).select("*"),
        supabase.from("team_member_commission_overrides" as any).select("*"),
      ]);

      const { data: settingsRow } = await (supabase as any)
        .from("platform_settings")
        .select("id,partner_commission_rate,ambassador_commission_rate,team_member_commission_rate")
        .limit(1)
        .maybeSingle();
      if (settingsRow) {
        setGlobals({
          id: settingsRow.id,
          partner: Number(settingsRow.partner_commission_rate ?? 500),
          ambassador: Number(settingsRow.ambassador_commission_rate ?? 300),
          team: Number(settingsRow.team_member_commission_rate ?? 100),
        });
      }

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

  /** Persists the partner override. Only called once any required override is cleared. */
  const persistPartnerOverride = async () => {
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
      if (newPartnerOverride.show_all_cases === true) {
        await (supabase as any).rpc("log_user_activity", {
          p_action: "grant_all_cases_visibility",
          p_target_id: newPartnerOverride.partner_id,
          p_target_table: "partner_commission_overrides",
          p_details: "Admin override confirmed",
        });
      }
      setNewPartnerOverride({ partner_id: "", amount: "", notes: "", show_all_cases: null });
      toast({ description: t("commissionSettings.partnerSaved") });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const addPartnerOverride = async () => {
    if (!newPartnerOverride.partner_id || !newPartnerOverride.amount) return;
    // Widening visibility to every case exposes student data — require an
    // explicit administrator override before it can be saved.
    if (newPartnerOverride.show_all_cases === true) {
      setGateOpen(true);
      return;
    }
    await persistPartnerOverride();
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
      setNewTeamOverride({ team_member_id: "", amount: "", notes: "" });
      toast({ description: "Team member commission saved ✓" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  const saveGlobals = async () => {
    if (!globals.id) return;
    setSavingGlobals(true);
    try {
      const { error } = await (supabase as any)
        .from("platform_settings")
        .update({
          partner_commission_rate: globals.partner,
          ambassador_commission_rate: globals.ambassador,
          team_member_commission_rate: globals.team,
          updated_at: new Date().toISOString(),
        })
        .eq("id", globals.id);
      if (error) throw error;
      toast({ description: "Default commission amounts saved ✓" });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSavingGlobals(false);
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
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-border text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <p>
          All commissions are a <strong>flat amount in shekels (₪)</strong> per enrolled student — there are no
          percentages and no tiers. Each role has a default amount below. If an individual account is given its
          own amount, <strong>that per-person amount always wins</strong> over the default.
        </p>
      </div>

      {/* Global flat defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" />
            Default Commission per Enrolled Student (₪)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Partner</label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={globals.partner}
                onChange={(e) => setGlobals((g) => ({ ...g, partner: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ambassador</label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={globals.ambassador}
                onChange={(e) => setGlobals((g) => ({ ...g, ambassador: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Team Member</label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={globals.team}
                onChange={(e) => setGlobals((g) => ({ ...g, team: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <Button size="sm" onClick={saveGlobals} disabled={savingGlobals || !globals.id}>
            {savingGlobals && <Loader2 className="h-3.5 w-3.5 me-2 animate-spin" />}
            Save defaults
          </Button>
        </CardContent>
      </Card>

      {/* Partner Commission — per account */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Partner &amp; Ambassador Commission (per account)
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing overrides */}
          {partnerOverrides.length > 0 && (
            <div className="space-y-2">
              {partnerOverrides.map((ov) => (
                <div key={ov.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{ov.partner_name}</p>
                    {ov.notes && <p className="text-xs text-muted-foreground truncate">{ov.notes}</p>}
                  </div>
                  <Badge variant="secondary" className="font-mono shrink-0">
                    ₪{ov.commission_amount.toLocaleString("en-US")} / student
                  </Badge>
                  <Badge variant={visibilityBadgeVariant(ov.show_all_cases)} className="text-xs whitespace-nowrap shrink-0">
                    <Eye className="h-3 w-3 me-1" />
                    {visibilityLabel(ov.show_all_cases)}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => deletePartnerOverride(ov.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {partnerOverrides.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">No per-account amounts configured — everyone uses the default above.</p>
          )}

          {/* Add / update form */}
          <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add / Update Partner</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select
                value={newPartnerOverride.partner_id}
                onValueChange={(v) => setNewPartnerOverride((p) => ({ ...p, partner_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select partner / ambassador account" />
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
                  placeholder="Amount per student"
                  className="pl-7"
                  value={newPartnerOverride.amount}
                  onChange={(e) => setNewPartnerOverride((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Notes (optional)"
                value={newPartnerOverride.notes}
                onChange={(e) => setNewPartnerOverride((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>

            {/* Case visibility selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Which cases can this partner see?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {VISIBILITY_OPTIONS.map((opt) => {
                  const currentVal = newPartnerOverride.show_all_cases;
                  const isSelected =
                    opt.value === "true" ? currentVal === true :
                    opt.value === "false" ? currentVal === false :
                    currentVal === null;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setNewPartnerOverride((p) => ({
                          ...p,
                          show_all_cases: opt.value === "null" ? null : opt.value === "true",
                        }))
                      }
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="font-semibold">{opt.label}</p>
                      <p className={`mt-0.5 ${isSelected ? "opacity-80" : "text-muted-foreground"}`}>{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              size="sm"
              onClick={addPartnerOverride}
              disabled={!newPartnerOverride.partner_id || !newPartnerOverride.amount}
            >
              Save Partner Commission
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Member Commission — per account */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4 text-primary" />
              Team Member Commission
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing overrides */}
          {teamOverrides.length > 0 && (
            <div className="space-y-2">
              {teamOverrides.map((ov) => (
                <div key={ov.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{ov.member_name}</p>
                    {ov.notes && <p className="text-xs text-muted-foreground truncate">{ov.notes}</p>}
                  </div>
                  <Badge variant="secondary" className="font-mono shrink-0">
                    ₪{ov.commission_amount.toLocaleString("en-US")} / student
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => deleteTeamOverride(ov.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {teamOverrides.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">No team member commissions configured yet.</p>
          )}

          {/* Add / update form */}
          <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add / Update Team Member</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select
                value={newTeamOverride.team_member_id}
                onValueChange={(v) => setNewTeamOverride((p) => ({ ...p, team_member_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
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
                  placeholder="Amount per student"
                  className="pl-7"
                  value={newTeamOverride.amount}
                  onChange={(e) => setNewTeamOverride((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Notes (optional)"
                value={newTeamOverride.notes}
                onChange={(e) => setNewTeamOverride((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <Button
              size="sm"
              onClick={addTeamOverride}
              disabled={!newTeamOverride.team_member_id || !newTeamOverride.amount}
            >
              Save Team Member Commission
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

