import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UserPlus, RefreshCw, Copy, CheckCheck, Trash2, Link2, ShieldCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { buildReferralUrl } from '@/lib/referral';
import { formatILS } from '@/lib/money';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  referral_code: string | null;
  /** Flat ILS amount this account actually earns per enrolled student. */
  commission: number;
  /** True when the amount comes from a per-account override, not the default. */
  commissionOverridden: boolean;
  /** Managers are visible to team members in the internal chat directory. */
  is_manager: boolean;
}

/** Roles that get a public referral link of their own. */
const REFERRING_ROLES = ['social_media_partner', 'ambassador'];


const AdminTeamPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const isRtl = i18n.language === 'ar';

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newCreds, setNewCreds] = useState<{ email: string; password: string } | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({ fullName: '', email: '', role: 'team_member' });

  const fetchMembers = useCallback(async () => {
    try {
      const rolesRes = await supabase
        .from('user_roles')
        .select('user_id, role, created_at')
        .in('role', ['team_member', 'social_media_partner', 'ambassador']);
      if (rolesRes.error) throw rolesRes.error;

      const userIds = (rolesRes.data || []).map(r => r.user_id);
      if (userIds.length === 0) { setMembers([]); setLoading(false); return; }

      const [profilesRes, settingsRes, partnerOvRes, teamOvRes] = await Promise.all([
        (supabase as any).from('profiles').select('id, full_name, email, referral_code, referral_code_enabled, is_manager').in('id', userIds),
        (supabase as any).from('platform_settings').select('partner_commission_rate, ambassador_commission_rate, team_member_commission_rate').limit(1).maybeSingle(),
        (supabase as any).from('partner_commission_overrides').select('partner_id, commission_amount'),
        (supabase as any).from('team_member_commission_overrides').select('team_member_id, commission_amount'),
      ]);
      if (profilesRes.error) throw profilesRes.error;

      const profileMap: Record<string, any> = {};
      (profilesRes.data || []).forEach((p: any) => { profileMap[p.id] = p; });

      const overrideMap: Record<string, number> = {};
      (partnerOvRes.data || []).forEach((o: any) => { overrideMap[o.partner_id] = o.commission_amount; });
      (teamOvRes.data || []).forEach((o: any) => { overrideMap[o.team_member_id] = o.commission_amount; });

      const defaults: Record<string, number> = {
        social_media_partner: settingsRes.data?.partner_commission_rate ?? 0,
        ambassador: settingsRes.data?.ambassador_commission_rate ?? 0,
        team_member: settingsRes.data?.team_member_commission_rate ?? 0,
      };

      const enriched = (rolesRes.data || []).map(r => ({
        id: r.user_id,
        full_name: profileMap[r.user_id]?.full_name || '–',
        email: profileMap[r.user_id]?.email || '–',
        role: r.role,
        created_at: r.created_at,
        referral_code:
          profileMap[r.user_id]?.referral_code_enabled === false
            ? null
            : profileMap[r.user_id]?.referral_code ?? null,
        commission: overrideMap[r.user_id] ?? defaults[r.role] ?? 0,
        commissionOverridden: overrideMap[r.user_id] !== undefined,
        is_manager: profileMap[r.user_id]?.is_manager === true,
      }));


      setMembers(enriched);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const createMember = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      toast({ variant: 'destructive', description: t('admin.team.allFieldsRequired') });
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-team-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ full_name: form.fullName, email: form.email, role: form.role }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to create member');
      setNewCreds({ email: form.email, password: result.tempPassword || result.temp_password });
      setForm({ fullName: '', email: '', role: 'team_member' });
      await fetchMembers();
      toast({ description: t('admin.team.accountCreated') });
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      // Remove role so they can no longer access partner dashboard
      const { error: roleErr } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', deleteTargetId);
      if (roleErr) throw roleErr;

      // Soft-delete the profile
      await (supabase as any)
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteTargetId);

      toast({ description: t('admin.team.accountDeleted', 'Account deleted successfully') });
      setDeleteTargetId(null);
      await fetchMembers();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const toggleManager = async (memberId: string, next: boolean) => {
    setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, is_manager: next } : m)));
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ is_manager: next })
      .eq('id', memberId);
    if (error) {
      setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, is_manager: !next } : m)));
      toast({ variant: 'destructive', description: error.message });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      team_member: t('admin.team.teamMemberRole'),
      social_media_partner: t('admin.team.partnerRole'),
      ambassador: t('admin.team.ambassadorRole', 'Ambassador'),
    };
    return map[role] || role;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('admin.team.title', 'Team Members')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchMembers} className="gap-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                {t('admin.team.createMember', 'Create Member')}
              </Button>
            </DialogTrigger>
            <DialogContent dir={isRtl ? 'rtl' : 'ltr'} className="max-w-[95vw] sm:max-w-lg w-full">
              <DialogHeader>
                <DialogTitle>{t('admin.team.createMember', 'Create Team Member')}</DialogTitle>
              </DialogHeader>

              {newCreds ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('admin.team.credentialsHint')}
                  </p>
                  <div className="p-4 rounded-lg bg-muted space-y-2">
                    <p className="text-sm"><span className="font-medium">{t('admin.team.email', 'Email')}:</span> {newCreds.email}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm"><span className="font-medium">{t('admin.team.tempPassword', 'Temp Password')}:</span> {newCreds.password}</p>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(newCreds.password)}>
                        {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => { setNewCreds(null); setOpen(false); }}>
                    {t('common.done', 'Done')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <Label>{t('admin.team.fullName', 'Full Name')}</Label>
                    <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.team.email', 'Email')}</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.team.role', 'Role')}</Label>
                    <Select value={form.role} onValueChange={val => setForm(f => ({ ...f, role: val }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team_member">{t('admin.team.teamMemberRole')}</SelectItem>
                        <SelectItem value="social_media_partner">{t('admin.team.partnerRole')}</SelectItem>
                        <SelectItem value="ambassador">{t('admin.team.ambassadorRole', 'Ambassador')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full"
                    onClick={createMember}
                    disabled={creating}
                  >
                    {creating ? t('admin.team.creating') : t('admin.team.createBtn', 'Create Account')}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Members List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('admin.team.loading')}</div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('admin.team.noMembers', 'No team members yet')}</div>
          ) : (
            <div className="divide-y divide-border">
              {members.map(m => (
                <div key={m.id} className="flex items-start justify-between gap-3 p-4 hover:bg-muted/50 transition-colors flex-wrap">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${onlineUsers.has(m.id) ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                        title={t(onlineUsers.has(m.id) ? 'chat.presence.online' : 'chat.presence.offline')}
                      />
                      {m.full_name}
                      {onlineUsers.has(m.id) && (
                        <span className="text-[10px] font-normal text-emerald-600">
                          {t('chat.presence.online')}
                        </span>
                      )}
                    </p>

                    <p className="text-xs text-muted-foreground">{m.email}</p>
                    {REFERRING_ROLES.includes(m.role) && m.referral_code && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(buildReferralUrl(m.referral_code!))}
                        className="mt-1.5 flex items-center gap-1.5 text-xs text-primary hover:underline max-w-full"
                        title={t('admin.team.copyReferralLink', 'Copy referral link')}
                      >
                        <Link2 className="h-3 w-3 shrink-0" />
                        <span className="truncate font-mono">{buildReferralUrl(m.referral_code)}</span>
                        <Copy className="h-3 w-3 shrink-0" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === 'team_member' && (
                      <label
                        className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                        title={t('admin.team.managerHint', 'Managers are reachable by all team members in the internal chat')}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{t('admin.team.manager', 'Manager')}</span>
                        <Switch
                          checked={m.is_manager}
                          onCheckedChange={(v) => toggleManager(m.id, v)}
                        />
                      </label>
                    )}
                    <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                    <Badge
                      variant={m.commissionOverridden ? 'default' : 'outline'}
                      className="font-mono whitespace-nowrap"
                      title={m.commissionOverridden
                        ? t('admin.team.commissionCustom', 'Custom amount for this account')
                        : t('admin.team.commissionDefault', 'Default amount for this role')}
                    >
                      {formatILS(m.commission)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTargetId(m.id)}
                      title={t('admin.team.deleteAccount', 'Delete Account')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(v) => { if (!v) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.team.deleteConfirmTitle', 'Delete Account?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.team.deleteConfirmDesc', 'This will remove the account and revoke all access. This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteMember}
              disabled={deleting}
            >
              {deleting ? '...' : t('admin.team.confirmDelete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminTeamPage;
