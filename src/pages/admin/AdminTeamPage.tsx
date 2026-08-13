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
import { UserPlus, RefreshCw, Copy, CheckCheck, Trash2, Link2, ShieldCheck, Mail, Send, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Crown } from 'lucide-react';
import MasterPartnerToggle from '@/components/admin/MasterPartnerToggle';
import TeamMemberDetailSheet from '@/components/admin/TeamMemberDetailSheet';
import DeactivateAccountDialog from '@/components/admin/DeactivateAccountDialog';
import { buildReferralUrl } from '@/lib/referral';
import { formatILS } from '@/lib/money';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import { identityConflictMessage } from '@/lib/identityConflict';
import { checkEmailAvailability } from '@/lib/checkEmailAvailability';

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
  /** Partners upgraded to master partner get the network dashboard. */
  is_master_partner: boolean;
}

interface PendingInvitation {
  id: string;
  invited_email: string;
  invited_name: string | null;
  invitation_type: string;
  intended_role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

/** Roles that get a public referral link of their own. */
const REFERRING_ROLES = ['social_media_partner', 'ambassador'];


const AdminTeamPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const isRtl = i18n.language === 'ar';
  const onlineUsers = useOnlineUsers();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newCreds, setNewCreds] = useState<{ email: string; password: string } | null>(null);
  const [invitedInfo, setInvitedInfo] = useState<{ email: string; emailed: boolean; url: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [detailMember, setDetailMember] = useState<TeamMember | null>(null);
  /** 'invite' sends a branded activation email; 'manual' shows a temp password. */
  const [mode, setMode] = useState<'invite' | 'manual'>('invite');
  const [busyInvite, setBusyInvite] = useState<string | null>(null);


  const [form, setForm] = useState({ fullName: '', email: '', role: 'team_member' });

  /** Turns an identity collision into a message that explains the conflict. */
  const conflictMessage = useCallback(
    (result: any) => identityConflictMessage(result, t),
    [t],
  );


  const callInviteFn = useCallback(async (payload: Record<string, unknown>) => {
    // A stale/expired access token makes the edge function reject with 401
    // "Invalid token". Force a refresh first and fail with a clear message.
    let { data: { session } } = await supabase.auth.getSession();
    const expSoon = !session?.expires_at || session.expires_at * 1000 - Date.now() < 60_000;
    if (expSoon) {
      const { data } = await supabase.auth.refreshSession();
      session = data.session ?? session;
    }
    if (!session?.access_token) {
      throw new Error(
        t('admin.team.sessionExpired', 'Your session expired. Please sign in again and retry.'),
      );
    }
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (resp.status === 401) {
        throw new Error(
          t('admin.team.sessionExpired', 'Your session expired. Please sign in again and retry.'),
        );
      }
      throw new Error(conflictMessage(result) || (result as any)?.error || 'Request failed');
    }
    return result;
  }, [conflictMessage, t]);


  const fetchInvitations = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('user_invitations')
      .select('id, invited_email, invited_name, invitation_type, intended_role, status, expires_at, created_at')
      .eq('status', 'pending')
      .in('invitation_type', ['team', 'partner', 'ambassador'])
      .order('created_at', { ascending: false });
    setInvitations((data || []) as PendingInvitation[]);
  }, []);

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
        (supabase as any).from('profiles').select('id, full_name, email, referral_code, referral_code_enabled, is_manager, is_master_partner').in('id', userIds),
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

      // A user can hold more than one role row; the directory shows one card per
      // person, otherwise React sees duplicate keys and the list renders twice.
      const seen = new Set<string>();
      const enriched = (rolesRes.data || [])
        .filter(r => {
          if (seen.has(r.user_id)) return false;
          seen.add(r.user_id);
          return true;
        })
        .map(r => ({
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
          is_master_partner: profileMap[r.user_id]?.is_master_partner === true,
        }));


      setMembers(enriched);
    } catch {
      toast({ variant: 'destructive', title: t('common.error', 'Error'), description: t('common.actionFailed', 'Something went wrong. Please try again or contact support.') });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchMembers(); fetchInvitations(); }, [fetchMembers, fetchInvitations]);

  const createMember = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      toast({ variant: 'destructive', description: t('admin.team.allFieldsRequired') });
      return;
    }
    setCreating(true);
    try {
      // Catch identity collisions (email already holds another role) before the
      // edge function rejects with a 409 the user can't act on.
      try {
        const availability = await checkEmailAvailability(form.email.trim());
        if (!availability.available) {
          throw new Error(
            conflictMessage({
              code: 'identity_conflict',
              existing_role: availability.existing_role ?? undefined,
              intended_role: form.role,
              deactivated: availability.deactivated,
            }) ?? t('admin.team.conflictActive', { role: t('admin.team.someRole', 'another') }),
          );
        }
      } catch (checkErr: any) {
        // Only surface real conflicts; a failed check falls through to the server.
        if (checkErr instanceof Error && checkErr.message && !('status' in checkErr)) {
          if (checkErr.message !== 'email-availability check failed') throw checkErr;
        }
      }

      if (mode === 'invite') {
        const result = await callInviteFn({
          action: 'send',
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          role: form.role,
        });
        setInvitedInfo({ email: form.email.trim(), emailed: !!result.emailed, url: result.activationUrl });
        setForm({ fullName: '', email: '', role: 'team_member' });
        await fetchInvitations();
        toast({ description: t('admin.team.invitationSent', 'Invitation sent') });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-team-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ full_name: form.fullName, email: form.email, role: form.role }),
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(
          conflictMessage(result) ||
            (result as any)?.error ||
            t('admin.team.createFailed', 'Failed to create member'),
        );
      }
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

  const resendInvitation = async (inv: PendingInvitation) => {
    setBusyInvite(inv.id);
    try {
      await callInviteFn({
        action: 'send',
        full_name: inv.invited_name || inv.invited_email.split('@')[0],
        email: inv.invited_email,
        role: inv.intended_role,
      });
      await fetchInvitations();
      toast({ description: t('admin.team.invitationSent', 'Invitation sent') });
    } catch (err: any) {
      // The throw site already localized identity-conflict explanations and
      // falls back to a generic message, so this is never a raw server error.
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setBusyInvite(null);
    }
  };

  const revokeInvitation = async (inv: PendingInvitation) => {
    setBusyInvite(inv.id);
    try {
      await callInviteFn({ action: 'revoke', invitation_id: inv.id });
      await fetchInvitations();
      toast({ description: t('admin.team.invitationRevoked', 'Invitation revoked') });
    } catch {
      toast({ variant: 'destructive', title: t('common.error', 'Error'), description: t('common.actionFailed', 'Something went wrong. Please try again or contact support.') });
    } finally {
      setBusyInvite(null);
    }
  };

  // Account removal goes through admin_deactivate_account (DeactivateAccountDialog):
  // it revokes exactly one role, keeps every business record, and never touches
  // the auth identity or any other account.



  const toggleManager = async (memberId: string, next: boolean) => {
    setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, is_manager: next } : m)));
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ is_manager: next })
      .eq('id', memberId);
    if (error) {
      setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, is_manager: !next } : m)));
      toast({ variant: 'destructive', title: t('common.error', 'Error'), description: t('common.actionFailed', 'Something went wrong. Please try again or contact support.') });
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
                <DialogTitle>
                  {invitedInfo
                    ? t('admin.team.inviteSentTitle', 'Invitation sent')
                    : newCreds
                      ? t('admin.team.accountCreatedTitle', 'Account created')
                      : t('admin.team.createMember', 'Create Team Member')}
                </DialogTitle>
              </DialogHeader>

              {invitedInfo ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <CheckCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {invitedInfo.emailed
                        ? t('admin.team.inviteSentHint', 'An activation email was sent. The link works once and expires in 7 days.')
                        : t('admin.team.inviteEmailFailed', 'The invitation was created but the email could not be sent — share the link below instead.')}
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg bg-muted p-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t('admin.team.email', 'Email')}</p>
                      <p dir="ltr" className="break-all font-mono text-sm text-foreground">{invitedInfo.email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('admin.team.activationLink', 'Activation link')}
                      </p>
                      <p
                        dir="ltr"
                        className="select-all break-all rounded-md bg-background p-2 text-start font-mono text-xs leading-relaxed text-foreground"
                      >
                        {invitedInfo.url}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="secondary"
                        className="w-full gap-2 sm:flex-1"
                        onClick={() => copyToClipboard(invitedInfo.url)}
                      >
                        {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        {copied
                          ? t('admin.team.copied', 'Copied')
                          : t('admin.team.copyInviteLink', 'Copy activation link')}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full gap-2 sm:w-auto"
                        onClick={() => window.open(invitedInfo.url, '_blank', 'noopener')}
                      >
                        <Link2 className="h-4 w-4" />
                        {t('admin.team.openLink', 'Open')}
                      </Button>
                    </div>
                  </div>

                  <Button className="w-full" onClick={() => { setInvitedInfo(null); setOpen(false); }}>
                    {t('common.done', 'Done')}
                  </Button>
                </div>
              ) : newCreds ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('admin.team.credentialsHint')}
                  </p>
                  <div className="space-y-3 rounded-lg bg-muted p-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t('admin.team.email', 'Email')}</p>
                      <p dir="ltr" className="break-all font-mono text-sm text-foreground">{newCreds.email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t('admin.team.tempPassword', 'Temp Password')}</p>
                      <p dir="ltr" className="select-all break-all rounded-md bg-background p-2 text-start font-mono text-sm text-foreground">
                        {newCreds.password}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      className="w-full gap-2"
                      onClick={() => copyToClipboard(newCreds.password)}
                    >
                      {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      {copied ? t('admin.team.copied', 'Copied') : t('admin.team.copyPassword', 'Copy password')}
                    </Button>
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

                  <div className="space-y-2">
                    <Label>{t('admin.team.howToCreate', 'How should the account be created?')}</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        { key: 'invite', title: t('admin.team.modeInvite', 'Send invitation email'), desc: t('admin.team.modeInviteDesc', 'They receive a branded link and choose their own password.') },
                        { key: 'manual', title: t('admin.team.modeManual', 'Create manually'), desc: t('admin.team.modeManualDesc', 'You get a temporary password to pass on; they must change it at first sign-in.') },
                      ] as const).map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setMode(opt.key)}
                          className={`rounded-lg border p-3 text-start transition-colors ${mode === opt.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                        >
                          <span className="block text-sm font-medium text-foreground">{opt.title}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="w-full gap-2"
                    onClick={createMember}
                    disabled={creating}
                  >
                    {mode === 'invite' ? <Mail className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {creating
                      ? t('admin.team.creating')
                      : mode === 'invite'
                        ? t('admin.team.sendInvite', 'Send invitation')
                        : t('admin.team.createBtn', 'Create Account')}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3 text-sm font-medium text-foreground">
              {t('admin.team.pendingInvites', 'Pending invitations')}
            </div>
            <div className="divide-y divide-border">
              {invitations.map(inv => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {inv.invited_name || inv.invited_email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{inv.invited_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('admin.team.inviteExpires', 'Expires')}:{' '}
                      {new Date(inv.expires_at).toLocaleDateString('en-US')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{roleLabel(inv.intended_role)}</Badge>
                    <Badge variant="outline">{t('admin.team.invited', 'Invited')}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={busyInvite === inv.id}
                      onClick={() => resendInvitation(inv)}
                      title={t('admin.team.resendInvite', 'Resend invitation')}
                      aria-label={t('admin.team.resendInvite', 'Resend invitation')}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      disabled={busyInvite === inv.id}
                      onClick={() => revokeInvitation(inv)}
                      title={t('admin.team.revokeInvite', 'Revoke invitation')}
                      aria-label={t('admin.team.revokeInvite', 'Revoke invitation')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                    <button
                      type="button"
                      className="min-w-0 text-start"
                      onClick={() => setDetailMember(m)}
                      aria-label={t('admin.team.viewDetails', 'View performance details')}
                    >
                      <p className="flex items-center gap-2 text-sm font-medium text-foreground hover:underline">
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
                        {m.is_master_partner && (
                          <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700">
                            <Crown className="h-3 w-3" />{t('admin.payouts.masterBadge', 'Master')}
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </button>


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
                    {m.role === 'social_media_partner' && (
                      <MasterPartnerToggle
                        partnerId={m.id}
                        partnerName={m.full_name}
                        isMaster={m.is_master_partner}
                        onChanged={(next) => setMembers(prev => prev.map(x => (x.id === m.id ? { ...x, is_master_partner: next } : x)))}
                      />
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
                      onClick={() => setDeleteTarget(m)}
                      title={t('admin.team.deactivateAccount', 'Deactivate account')}
                      aria-label={t('admin.team.deactivateAccount', 'Deactivate account')}
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

      <TeamMemberDetailSheet
        memberId={detailMember?.id ?? null}
        memberName={detailMember?.full_name ?? ''}
        memberEmail={detailMember?.email ?? ''}
        role={detailMember?.role ?? 'team_member'}
        roleLabel={detailMember ? roleLabel(detailMember.role) : ''}
        commission={detailMember?.commission ?? 0}
        onOpenChange={(open) => { if (!open) setDetailMember(null); }}
      />

      {/* Explicit deactivation — never a silent cross-account delete */}
      <DeactivateAccountDialog
        target={
          deleteTarget
            ? {
                id: deleteTarget.id,
                full_name: deleteTarget.full_name,
                email: deleteTarget.email,
                roleLabel: roleLabel(deleteTarget.role),
              }
            : null
        }
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        onDone={fetchMembers}
      />

    </div>
  );
};

export default AdminTeamPage;
