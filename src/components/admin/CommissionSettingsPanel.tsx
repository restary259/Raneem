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
const VISIBILITY_OPTIONS = [
  {
    value: "true",
    label: "All Cases",
    desc: "Sees all cases in the system",
    badgeVariant: "default" as const,
  },
  {
    value: "false",
    label: "Apply / Contact Only",
    desc: "Only auto-generated leads from Apply and Contact pages",
    badgeVariant: "outline" as const,
  },
  {
    value: "null",
    label: "Referral Cases Only",
    desc: "Only cases that came through referral links",
    badgeVariant: "secondary" as const,
  },
] as const;

function visibilityLabel(val: boolean | null): string {
  if (val === true) return "All Cases";
  if (val === false) return "Apply / Contact Only";
  return "Referral Cases Only";
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [partnerRolesRes, teamRolesRes, partnerOvRes, teamOvRes] = await Promise.all([
        supabase.from("user_roles" as any).select("user_id").eq("role", "social_media_partner"),
        supabase.from("user_roles" as any).select("user_id").eq("role", "team_member"),
        supabase.from("partner_commission_overrides" as any).select("*"),
        supabase.from("team_member_commission_overrides" as any).select("*"),
      ]);

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
      toast({ description: "Partner commission saved ✓" });
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
      setNewTeamOverride({ team_member_id: "", amount: "", notes: "" });
      toast({ description: "Team member commission saved ✓" });
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
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-border text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <p>
          Commission amounts set here are the exact amounts that will appear on each account's earnings dashboard per enrolled student.
          Configure each account individually below.
        </p>
      </div>

      {/* Partner Commission — per account */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Partner Commission
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
            <p className="text-sm text-muted-foreground text-center py-3">No partner commissions configured yet.</p>
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
                  <SelectValue placeholder="Select partner account" />
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

