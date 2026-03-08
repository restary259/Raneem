import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, RefreshCw, Copy, CheckCheck } from 'lucide-react';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

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

  const [form, setForm] = useState({ fullName: '', email: '', role: 'team_member' });

  const fetchMembers = useCallback(async () => {
    try {
      const rolesRes = await supabase.from('user_roles').select('user_id, role, created_at').in('role', ['team_member', 'social_media_partner']);
      if (rolesRes.error) throw rolesRes.error;

      const userIds = (rolesRes.data || []).map(r => r.user_id);
      if (userIds.length === 0) { setMembers([]); setLoading(false); return; }

      const profilesRes = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
      if (profilesRes.error) throw profilesRes.error;

      const profileMap: Record<string, { full_name: string; email: string }> = {};
      (profilesRes.data || []).forEach(p => { profileMap[p.id] = p; });

      const enriched = (rolesRes.data || []).map(r => ({
        id: r.user_id,
        full_name: profileMap[r.user_id]?.full_name || '–',
        email: profileMap[r.user_id]?.email || '–',
        role: r.role,
        created_at: r.created_at,
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      team_member: t('admin.team.teamMemberRole'),
      social_media_partner: t('admin.team.partnerRole'),
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
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={createMember} disabled={creating}>
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
                <div key={m.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTeamPage;
