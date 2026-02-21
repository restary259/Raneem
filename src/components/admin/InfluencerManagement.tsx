import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Loader2, UserX, RotateCcw, Trash2, Copy, Check, ShieldCheck } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';
import PullToRefresh from '@/components/common/PullToRefresh';

interface InfluencerManagementProps {
  influencers: any[];
  invites: any[];
  students: any[];
  lawyers?: any[];
  onRefresh: () => void;
  filterRole?: 'influencer' | 'lawyer';
  /** Lifted to parent so credentials survive any re-render/remount of this component */
  pendingCredentials?: { email: string; password: string } | null;
  onCredentialsCreated: (email: string, password: string) => void;
  onCredentialsDismissed: () => void;
}

const InfluencerManagement: React.FC<InfluencerManagementProps> = ({
  influencers,
  invites,
  students,
  lawyers = [],
  onRefresh,
  filterRole,
  pendingCredentials,
  onCredentialsCreated,
  onCredentialsDismissed,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'influencer' | 'lawyer'>(filterRole || 'influencer');
  const [commission, setCommission] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();

  const allTeamMembers = (() => {
    const raw = filterRole === 'lawyer'
      ? lawyers.map(l => ({ ...l, _role: 'lawyer' }))
      : filterRole === 'influencer'
      ? influencers.map(i => ({ ...i, _role: 'influencer' }))
      : [
          ...influencers.map(i => ({ ...i, _role: 'influencer' })),
          ...lawyers.map(l => ({ ...l, _role: 'lawyer' })),
        ];
    // Sort by student count descending (#17)
    return [...raw].sort((a, b) => {
      const countA = students.filter((s: any) => s.influencer_id === a.id).length;
      const countB = students.filter((s: any) => s.influencer_id === b.id).length;
      return countB - countA;
    });
  })();

  const handleCreate = async () => {
    if (!name || !email) return;
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-team-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email, full_name: name, role: filterRole || role, commission_amount: commission ? parseInt(commission) : 0 }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to create');

      if (!result.temp_password) {
        throw new Error('Account created but no temporary password was returned. Contact support.');
      }

      // Lift credentials to parent — parent state survives any re-render of this child
      onCredentialsCreated(email, result.temp_password);
      setDialogOpen(false);
      setName(''); setEmail(''); setCommission(''); setRole(filterRole || 'influencer');
      // onRefresh() is called when admin dismisses the credentials modal (in parent)
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
    } finally {
      setIsCreating(false);
    }
  };

  const copyPassword = () => {
    if (pendingCredentials?.password) {
      navigator.clipboard.writeText(pendingCredentials.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyEmail = () => {
    if (pendingCredentials?.email) {
      navigator.clipboard.writeText(pendingCredentials.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleDismissCredentials = () => {
    setCopied(false);
    setCopiedEmail(false);
    onCredentialsDismissed(); // clears parent state + calls onRefresh
  };

  const getStudentCount = (influencerId: string) => students.filter(s => s.influencer_id === influencerId).length;

  const handleToggleAgent = async (agentId: string, newStatus: string) => {
    const { error } = await (supabase as any).from('profiles').update({ student_status: newStatus }).eq('id', agentId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { toast({ title: newStatus === 'inactive' ? t('admin.influencers.deactivated') : t('admin.influencers.restored') }); onRefresh(); }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    const { error } = await (supabase as any).from('influencer_invites').delete().eq('id', inviteId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { toast({ title: t('team.inviteDeleted') }); onRefresh(); }
  };

  const [purgeTarget, setPurgeTarget] = useState<any | null>(null);
  const [purgeTransferTo, setPurgeTransferTo] = useState('');
  const [forcePurge, setForcePurge] = useState(false);
  const [purging, setPurging] = useState(false);

  const handlePurgeAccount = async () => {
    if (!purgeTarget) return;
    setPurging(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/purge-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          target_user_id: purgeTarget.id,
          transfer_to: purgeTransferTo || undefined,
          force_purge: forcePurge,
          reason: 'Admin permanent deletion',
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to purge');
      toast({ title: t('team.accountPurged', { defaultValue: 'Account permanently deleted' }) });
      setPurgeTarget(null);
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
    }
    setPurging(false);
  };

  const ActionButtons = ({ member }: { member: any }) => (
    member.student_status === 'inactive' ? (
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => handleToggleAgent(member.id, 'eligible')}><RotateCcw className="h-3 w-3 me-1" />{t('team.restore')}</Button>
        <Button size="sm" variant="destructive" onClick={() => { setPurgeTarget(member); setPurgeTransferTo(''); setForcePurge(false); }}>
          <Trash2 className="h-3 w-3 me-1" />{t('team.purge', { defaultValue: 'Delete' })}
        </Button>
      </div>
    ) : (
      <div className="flex gap-1">
        <AlertDialog>
          <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><UserX className="h-3 w-3 me-1" />{t('team.deactivate')}</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('team.deactivateTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('team.deactivateDesc', { name: member.full_name })}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleToggleAgent(member.id, 'inactive')}>{t('admin.influencers.confirmBtn')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setPurgeTarget(member); setPurgeTransferTo(''); setForcePurge(false); }}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    )
  );

  const pageTitle = filterRole === 'lawyer' ? t('admin.tabs.teamMembers') : filterRole === 'influencer' ? t('admin.tabs.influencers') : t('team.title');

  return (
    <PullToRefresh onRefresh={async () => { onRefresh(); }} disabled={isCreating}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{pageTitle}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setName(''); setEmail(''); setCommission(''); setRole(filterRole || 'influencer'); }}>
              <UserPlus className="h-4 w-4 me-2" />{t('team.addMember')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('team.createTitle')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {!filterRole && (
                <div><Label>{t('team.roleLabel')}</Label>
                  <Select value={role} onValueChange={(v: 'influencer' | 'lawyer') => setRole(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="influencer">{t('team.roleInfluencer')}</SelectItem>
                      <SelectItem value="lawyer">{t('team.roleTeamMember')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>{t('admin.influencers.fullName')}</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={t('team.namePlaceholder')} /></div>
              <div><Label>{t('admin.influencers.email')}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" /></div>
              <div><Label>{t('team.commission', { defaultValue: 'Commission (₪)' })}</Label><Input type="number" min="0" value={commission} onChange={e => setCommission(e.target.value)} placeholder="0" /></div>
              <Button className="w-full" onClick={handleCreate} disabled={isCreating || !name || !email}>
                {isCreating ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('team.creating')}</> : t('team.createAccount')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Credentials Modal — driven by parent state, immune to child re-renders */}
      <Dialog open={!!pendingCredentials} onOpenChange={() => {}}>
        <DialogContent onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t('team.accountCreatedSuccess', { defaultValue: 'Account Created — Save These Credentials' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('team.credentialsNote', { defaultValue: 'Share these credentials with the new member. They must change their password on first login.' })}
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.influencers.email')}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-muted border rounded px-3 py-2 font-mono break-all">{pendingCredentials?.email}</code>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={copyEmail}>
                    {copiedEmail ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('team.tempPassword', { defaultValue: 'Temporary Password' })}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-muted border rounded px-3 py-2 font-mono font-bold tracking-wider">{pendingCredentials?.password}</code>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={copyPassword}>
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
              <p className="text-xs text-warning-foreground font-medium">
                ⚠️ {t('team.passwordWarning', { defaultValue: 'This password will NOT be shown again. Copy it now and send it securely to the new member.' })}
              </p>
            </div>
            <Button className="w-full" onClick={handleDismissCredentials}>
              {t('team.savedCredentials', { defaultValue: "I've Saved the Credentials — Close" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isMobile ? (
        <div className="space-y-3">
          {allTeamMembers.map(inf => (
            <Card key={inf.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm break-all">{inf.full_name}</span>
                  <Badge variant="outline">{inf._role === 'lawyer' ? t('team.teamMemberRole') : t('team.agent')}</Badge>
                </div>
                <p className="text-xs text-muted-foreground break-all">{inf.email}</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{inf.commission_amount || 0} ₪</Badge>
                    {inf._role === 'influencer' && <Badge variant="secondary">{getStudentCount(inf.id)} {t('team.students')}</Badge>}
                    <Badge variant={inf.student_status === 'inactive' ? 'destructive' : 'default'}>{inf.student_status === 'inactive' ? t('team.inactive') : t('team.active')}</Badge>
                  </div>
                  <ActionButtons member={inf} />
                </div>
              </CardContent>
            </Card>
          ))}
          {allTeamMembers.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('team.noMembers')}</p>}
        </div>
      ) : (
        <Card className="w-full overflow-hidden">
          <div className="w-full overflow-x-auto">
           <table className="w-full table-fixed text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="w-[18%] px-4 py-3 text-start font-semibold">{t('team.name')}</th>
              <th className="w-[20%] px-4 py-3 text-start font-semibold">{t('team.email')}</th>
              <th className="w-[10%] px-4 py-3 text-start font-semibold">{t('team.role')}</th>
              <th className="w-[12%] px-4 py-3 text-start font-semibold">{t('team.commission', { defaultValue: 'Commission' })}</th>
              <th className="w-[10%] px-4 py-3 text-start font-semibold">{t('team.students')}</th>
              <th className="w-[12%] px-4 py-3 text-start font-semibold">{t('team.status')}</th>
              <th className="w-[18%] px-4 py-3 text-start font-semibold">{t('team.action')}</th>
            </tr></thead>
            <tbody>
              {allTeamMembers.map(inf => (
                <tr key={inf.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{inf.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground break-all">{inf.email}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{inf._role === 'lawyer' ? t('team.teamMemberRole') : t('team.agent')}</Badge></td>
                  <td className="px-4 py-3"><Badge variant="secondary">{inf.commission_amount || 0} ₪</Badge></td>
                  <td className="px-4 py-3"><Badge variant="secondary">{inf._role === 'influencer' ? getStudentCount(inf.id) : '—'}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={inf.student_status === 'inactive' ? 'destructive' : 'default'}>{inf.student_status === 'inactive' ? t('team.inactive') : t('team.active')}</Badge></td>
                  <td className="px-4 py-3"><ActionButtons member={inf} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {allTeamMembers.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('team.noMembers')}</p>}
          </div>
        </Card>
      )}

      {invites.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('team.invites')}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div><p className="font-medium text-sm">{inv.full_name}</p><p className="text-xs text-muted-foreground break-all">{inv.email}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inv.status === 'accepted' ? 'default' : 'secondary'}>{inv.status === 'accepted' ? t('team.accepted') : t('team.pending')}</Badge>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDeleteInvite(inv.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purge Account Confirmation Dialog */}
      <Dialog open={!!purgeTarget} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {t('team.purgeTitle', { defaultValue: 'Permanently Delete Account' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('team.purgeWarning', { defaultValue: 'This will permanently remove the user and all personal data. This action cannot be undone.' })}
            </p>
            <div>
              <Label className="text-xs">{t('team.transferCases', { defaultValue: 'Transfer assigned cases to (optional):' })}</Label>
              <Select value={purgeTransferTo} onValueChange={setPurgeTransferTo}>
                <SelectTrigger><SelectValue placeholder={t('team.selectMember', { defaultValue: 'Select team member...' })} /></SelectTrigger>
                <SelectContent>
                  {allTeamMembers.filter(m => m.id !== purgeTarget?.id && m.student_status !== 'inactive').map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!purgeTransferTo && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <input
                  type="checkbox"
                  id="force_purge"
                  checked={forcePurge}
                  onChange={e => setForcePurge(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="force_purge" className="text-xs cursor-pointer text-destructive">
                  {t('team.forcePurge', { defaultValue: 'Force delete — assigned cases will be unassigned (requires manual reassignment)' })}
                </Label>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPurgeTarget(null)}>{t('common.cancel')}</Button>
              <Button
                variant="destructive"
                onClick={handlePurgeAccount}
                disabled={purging || (!purgeTransferTo && !forcePurge)}
              >
                {purging ? t('common.loading') : t('team.confirmPurge', { defaultValue: 'Permanently Delete' })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
};

export default InfluencerManagement;
