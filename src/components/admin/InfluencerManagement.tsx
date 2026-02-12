import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Copy, Loader2, UserX, RotateCcw } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

interface InfluencerManagementProps { influencers: any[]; invites: any[]; students: any[]; onRefresh: () => void; }

const InfluencerManagement: React.FC<InfluencerManagementProps> = ({ influencers, invites, students, onRefresh }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const handleCreate = async () => {
    if (!name || !email) return;
    setIsCreating(true); setCreatedPassword('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      await (supabase as any).from('influencer_invites').insert({ email, full_name: name, invited_by: session.user.id });
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-influencer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email, full_name: name }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to create');
      setCreatedPassword(result.temp_password);
      toast({ title: t('admin.influencers.createSuccess') }); onRefresh();
    } catch (err: any) { toast({ variant: 'destructive', title: t('common.error'), description: err.message }); }
    finally { setIsCreating(false); }
  };

  const getStudentCount = (influencerId: string) => students.filter(s => s.influencer_id === influencerId).length;

  const handleToggleAgent = async (agentId: string, newStatus: string) => {
    const { error } = await (supabase as any).from('profiles').update({ student_status: newStatus }).eq('id', agentId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { toast({ title: newStatus === 'inactive' ? t('admin.influencers.deactivated') : t('admin.influencers.restored') }); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('admin.influencers.title')}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button onClick={() => { setName(''); setEmail(''); setCreatedPassword(''); }}><UserPlus className="h-4 w-4 me-2" />{t('admin.influencers.addAgent')}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('admin.influencers.createAccount')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t('admin.influencers.fullName')}</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={t('admin.influencers.agentNamePlaceholder')} /></div>
              <div><Label>{t('admin.influencers.email')}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" /></div>
              {createdPassword && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-green-800">{t('admin.influencers.accountCreated')}</p>
                  <p className="text-xs text-green-700">{t('admin.influencers.tempPassword')}</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-3 py-1 rounded border text-sm flex-1">{createdPassword}</code>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(createdPassword); toast({ title: t('admin.influencers.copied') }); }}><Copy className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-xs text-green-600">{t('admin.influencers.sharePassword')}</p>
                </div>
              )}
              {!createdPassword && (
                <Button className="w-full" onClick={handleCreate} disabled={isCreating || !name || !email}>
                  {isCreating ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('admin.influencers.creating')}</> : t('admin.influencers.createBtn')}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-background rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-start font-semibold">{t('admin.influencers.name')}</th>
            <th className="px-4 py-3 text-start font-semibold">{t('admin.influencers.email')}</th>
            <th className="px-4 py-3 text-start font-semibold">{t('admin.influencers.studentCount')}</th>
            <th className="px-4 py-3 text-start font-semibold">{t('admin.influencers.statusCol')}</th>
            <th className="px-4 py-3 text-start font-semibold">{t('admin.influencers.action')}</th>
          </tr></thead>
          <tbody>
            {influencers.map(inf => (
              <tr key={inf.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{inf.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{inf.email}</td>
                <td className="px-4 py-3"><Badge variant="secondary">{getStudentCount(inf.id)}</Badge></td>
                <td className="px-4 py-3"><Badge variant={inf.student_status === 'inactive' ? 'destructive' : 'default'}>{inf.student_status === 'inactive' ? t('admin.influencers.inactive') : t('admin.influencers.active')}</Badge></td>
                <td className="px-4 py-3">
                  {inf.student_status === 'inactive' ? (
                    <Button size="sm" variant="outline" onClick={() => handleToggleAgent(inf.id, 'eligible')}><RotateCcw className="h-3 w-3 me-1" />{t('admin.influencers.restore')}</Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><UserX className="h-3 w-3 me-1" />{t('admin.influencers.deactivate')}</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('admin.influencers.deactivateTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>{t('admin.influencers.deactivateDesc', { name: inf.full_name })}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('admin.influencers.cancelBtn')}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleToggleAgent(inf.id, 'inactive')}>{t('admin.influencers.confirmBtn')}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {influencers.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.influencers.noAgents')}</p>}
      </div>
      {invites.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('admin.influencers.invites')}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div><p className="font-medium text-sm">{inv.full_name}</p><p className="text-xs text-muted-foreground">{inv.email}</p></div>
                  <Badge variant={inv.status === 'accepted' ? 'default' : 'secondary'}>{inv.status === 'accepted' ? t('admin.influencers.accepted') : t('admin.influencers.pendingInvite')}</Badge>
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
