import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign, Users, Settings2, Eye, Save, Loader2,
  Percent, UserCog, RefreshCw, Trash2
} from 'lucide-react';

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
  const { toast } = useToast();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [partners, setPartners] = useState<UserProfile[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [partnerOverrides, setPartnerOverrides] = useState<PartnerOverride[]>([]);
  const [teamOverrides, setTeamOverrides] = useState<TeamOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Override form state
  const [newPartnerOverride, setNewPartnerOverride] = useState({ partner_id: '', amount: '', notes: '' });
  const [newTeamOverride, setNewTeamOverride] = useState({ team_member_id: '', amount: '', notes: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settRes, partnerRolesRes, teamRolesRes, partnerOvRes, teamOvRes] = await Promise.all([
        supabase.from('platform_settings' as any).select('*').limit(1).single(),
        supabase.from('user_roles' as any).select('user_id').eq('role', 'social_media_partner'),
        supabase.from('user_roles' as any).select('user_id').eq('role', 'team_member'),
        supabase.from('partner_commission_overrides' as any).select('*'),
        supabase.from('team_member_commission_overrides' as any).select('*'),
      ]);

      if (settRes.data) setSettings(settRes.data as PlatformSettings);

      // Fetch profiles for partners and team members
      const partnerIds = (partnerRolesRes.data || []).map((r: any) => r.user_id);
      const teamIds = (teamRolesRes.data || []).map((r: any) => r.user_id);

      const [profPartners, profTeam] = await Promise.all([
        partnerIds.length
          ? supabase.from('profiles' as any).select('id,full_name,email').in('id', partnerIds)
          : { data: [] },
        teamIds.length
          ? supabase.from('profiles' as any).select('id,full_name,email').in('id', teamIds)
          : { data: [] },
      ]);

      setPartners((profPartners.data || []) as UserProfile[]);
      setTeamMembers((profTeam.data || []) as UserProfile[]);

      // Enrich overrides with names
      const pOvData = (partnerOvRes.data || []) as PartnerOverride[];
      const tOvData = (teamOvRes.data || []) as TeamOverride[];

      setPartnerOverrides(pOvData.map(ov => ({
        ...ov,
        partner_name: (profPartners.data as any[])?.find(p => p.id === ov.partner_id)?.full_name ?? ov.partner_id.slice(0, 8),
      })));
      setTeamOverrides(tOvData.map(ov => ({
        ...ov,
        member_name: (profTeam.data as any[])?.find(p => p.id === ov.team_member_id)?.full_name ?? ov.team_member_id.slice(0, 8),
      })));
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveGlobalSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('platform_settings').update({
        partner_commission_rate: settings.partner_commission_rate,
        team_member_commission_rate: settings.team_member_commission_rate,
        partner_dashboard_show_all_cases: settings.partner_dashboard_show_all_cases,
        updated_at: new Date().toISOString(),
      }).eq('id', settings.id);
      if (error) throw error;
      toast({ description: 'Commission settings saved ✓' });
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const addPartnerOverride = async () => {
    if (!newPartnerOverride.partner_id || !newPartnerOverride.amount) return;
    try {
      const { error } = await (supabase as any).from('partner_commission_overrides').upsert({
        partner_id: newPartnerOverride.partner_id,
        commission_amount: parseInt(newPartnerOverride.amount),
        notes: newPartnerOverride.notes || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'partner_id' });
      if (error) throw error;
      setNewPartnerOverride({ partner_id: '', amount: '', notes: '' });
      toast({ description: 'Partner override saved ✓' });
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    }
  };

  const addTeamOverride = async () => {
    if (!newTeamOverride.team_member_id || !newTeamOverride.amount) return;
    try {
      const { error } = await (supabase as any).from('team_member_commission_overrides').upsert({
        team_member_id: newTeamOverride.team_member_id,
        commission_amount: parseInt(newTeamOverride.amount),
        notes: newTeamOverride.notes || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'team_member_id' });
      if (error) throw error;
      setNewTeamOverride({ team_member_id: '', amount: '', notes: '' });
      toast({ description: 'Team member override saved ✓' });
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    }
  };

  const deletePartnerOverride = async (id: string) => {
    await (supabase as any).from('partner_commission_overrides').delete().eq('id', id);
    fetchData();
  };

  const deleteTeamOverride = async (id: string) => {
    await (supabase as any).from('team_member_commission_overrides').delete().eq('id', id);
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
            Global Commission Rates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Partner Commission (ILS per paid case)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                <Input
                  type="number"
                  min="0"
                  className="pl-7"
                  value={settings?.partner_commission_rate ?? 500}
                  onChange={e => setSettings(s => s ? { ...s, partner_commission_rate: parseInt(e.target.value) || 0 } : s)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Default commission earned by a partner per paid submission
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <UserCog className="h-3.5 w-3.5" />
                Team Member Commission (ILS per paid case)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                <Input
                  type="number"
                  min="0"
                  className="pl-7"
                  value={settings?.team_member_commission_rate ?? 100}
                  onChange={e => setSettings(s => s ? { ...s, team_member_commission_rate: parseInt(e.target.value) || 0 } : s)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Default commission earned by assigned team member per paid case
              </p>
            </div>
          </div>

          {settings && (
            <div className="bg-muted/40 rounded-xl p-4 border border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-2">💡 Example calculation for a ₪2,000 case:</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Partner</p>
                  <p className="font-bold text-primary">₪{settings.partner_commission_rate.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Team Member</p>
                  <p className="font-bold text-purple-600">₪{settings.team_member_commission_rate.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Platform Revenue</p>
                  <p className="font-bold text-emerald-600">
                    ₪{Math.max(0, 2000 - settings.partner_commission_rate - settings.team_member_commission_rate).toLocaleString()}
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
            Partner Dashboard Visibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-muted/20">
            <div>
              <p className="text-sm font-semibold">Show All Cases to Partners</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                When <strong>off</strong>: partners only see Apply + Contact form cases.
                When <strong>on</strong>: partners see all cases in the system.
              </p>
            </div>
            <Switch
              checked={settings?.partner_dashboard_show_all_cases ?? false}
              onCheckedChange={v => setSettings(s => s ? { ...s, partner_dashboard_show_all_cases: v } : s)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Global Settings */}
      <Button onClick={saveGlobalSettings} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save Commission Settings
      </Button>

      {/* Per-Partner Overrides */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="h-4 w-4 text-primary" />
              Partner Commission Overrides
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
              {partnerOverrides.map(ov => (
                <div key={ov.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{ov.partner_name}</p>
                    {ov.notes && <p className="text-xs text-muted-foreground">{ov.notes}</p>}
                  </div>
                  <Badge variant="secondary" className="font-mono">₪{ov.commission_amount.toLocaleString()}</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePartnerOverride(ov.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new override */}
          <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Add / Update Override</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={newPartnerOverride.partner_id} onValueChange={v => setNewPartnerOverride(p => ({ ...p, partner_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="Amount"
                  className="pl-7"
                  value={newPartnerOverride.amount}
                  onChange={e => setNewPartnerOverride(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Notes (optional)"
                value={newPartnerOverride.notes}
                onChange={e => setNewPartnerOverride(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <Button size="sm" onClick={addPartnerOverride} disabled={!newPartnerOverride.partner_id || !newPartnerOverride.amount}>
              Save Partner Override
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-Team-Member Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" />
            Team Member Commission Overrides
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing overrides */}
          {teamOverrides.length > 0 && (
            <div className="space-y-2">
              {teamOverrides.map(ov => (
                <div key={ov.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{ov.member_name}</p>
                    {ov.notes && <p className="text-xs text-muted-foreground">{ov.notes}</p>}
                  </div>
                  <Badge variant="secondary" className="font-mono">₪{ov.commission_amount.toLocaleString()}</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTeamOverride(ov.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new override */}
          <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Add / Update Override</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={newTeamOverride.team_member_id} onValueChange={v => setNewTeamOverride(p => ({ ...p, team_member_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₪</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="Amount"
                  className="pl-7"
                  value={newTeamOverride.amount}
                  onChange={e => setNewTeamOverride(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Notes (optional)"
                value={newTeamOverride.notes}
                onChange={e => setNewTeamOverride(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <Button size="sm" onClick={addTeamOverride} disabled={!newTeamOverride.team_member_id || !newTeamOverride.amount}>
              Save Team Member Override
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
