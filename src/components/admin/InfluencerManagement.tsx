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
import { UserPlus, Loader2, UserX, RotateCcw, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

interface InfluencerManagementProps { influencers: any[]; invites: any[]; students: any[]; lawyers?: any[]; onRefresh: () => void; }

const InfluencerManagement: React.FC<InfluencerManagementProps> = ({ influencers, invites, students, lawyers = [], onRefresh }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'influencer' | 'lawyer'>('influencer');
  const [isCreating, setIsCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();

  const allTeamMembers = [
    ...influencers.map(i => ({ ...i, _role: 'influencer' })),
    ...lawyers.map(l => ({ ...l, _role: 'lawyer' })),
  ];

  const handleCreate = async () => {
    if (!name || !email) return;
    setIsCreating(true); setCreatedPassword('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      await (supabase as any).from('influencer_invites').insert({ email, full_name: name, invited_by: session.user.id });
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-team-member`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email, full_name: name, role }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to create');
      setCreatedPassword('sent_via_email');
      if (result.email_sent === false) {
        toast({ variant: 'destructive', title: 'Account created, but email failed', description: 'Share credentials manually with the team member.' });
      } else {
        toast({ title: t('admin.influencers.createSuccess') });
      }
      onRefresh();
    } catch (err: any) { toast({ variant: 'destructive', title: t('common.error'), description: err.message }); }
    finally { setIsCreating(false); }
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

  const ActionButtons = ({ member }: { member: any }) => (
    member.student_status === 'inactive' ? (
      <Button size="sm" variant="outline" onClick={() => handleToggleAgent(member.id, 'eligible')}><RotateCcw className="h-3 w-3 me-1" />{t('team.restore')}</Button>
    ) : (
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
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('team.title')}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button onClick={() => { setName(''); setEmail(''); setCreatedPassword(''); setRole('influencer'); }}><UserPlus className="h-4 w-4 me-2" />{t('team.addMember')}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('team.createTitle')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t('team.roleLabel')}</Label>
                <Select value={role} onValueChange={(v: 'influencer' | 'lawyer') => setRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="influencer">{t('team.roleInfluencer')}</SelectItem>
                    <SelectItem value="lawyer">{t('team.roleTeamMember')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('admin.influencers.fullName')}</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={t('team.namePlaceholder')} /></div>
              <div><Label>{t('admin.influencers.email')}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" /></div>
              {createdPassword && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-green-800">{t('admin.influencers.accountCreated')}</p>
                  <p className="text-xs text-green-700">{t('team.emailSent', { email })}</p>
                  <p className="text-xs text-green-600">{t('team.passwordChangeNote')}</p>
                </div>
              )}
              {!createdPassword && (
                <Button className="w-full" onClick={handleCreate} disabled={isCreating || !name || !email}>
                  {isCreating ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('team.creating')}</> : t('team.createAccount')}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
        <div className="bg-background rounded-xl border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-start font-semibold">{t('team.name')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('team.email')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('team.role')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('team.students')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('team.status')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('team.action')}</th>
            </tr></thead>
            <tbody>
              {allTeamMembers.map(inf => (
                <tr key={inf.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{inf.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground break-all">{inf.email}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{inf._role === 'lawyer' ? t('team.teamMemberRole') : t('team.agent')}</Badge></td>
                  <td className="px-4 py-3"><Badge variant="secondary">{inf._role === 'influencer' ? getStudentCount(inf.id) : '—'}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={inf.student_status === 'inactive' ? 'destructive' : 'default'}>{inf.student_status === 'inactive' ? t('team.inactive') : t('team.active')}</Badge></td>
                  <td className="px-4 py-3"><ActionButtons member={inf} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {allTeamMembers.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('team.noMembers')}</p>}
        </div>
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
    </div>
  );
};

export default InfluencerManagement;
