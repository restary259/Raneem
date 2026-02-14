import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bell, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ROLE_IDS = ['lawyer', 'user', 'influencer'] as const;

const CustomNotifications: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const roleLabels: Record<string, string> = {
    lawyer: t('admin.notifications.lawyers'),
    user: t('admin.notifications.students'),
    influencer: t('admin.notifications.agents'),
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const selectAll = () => {
    if (selectedRoles.length === ROLE_IDS.length) {
      setSelectedRoles([]);
    } else {
      setSelectedRoles([...ROLE_IDS]);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim() || selectedRoles.length === 0) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('admin.notifications.fillAllFields') });
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t('admin.notifications.notLoggedIn'));

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-custom-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), roles: selectedRoles }),
      });

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || t('admin.notifications.sendFailed'));

      toast({ title: t('admin.notifications.sent'), description: t('admin.notifications.sentDesc', { count: result.sent || 0 }) });
      setTitle('');
      setBody('');
      setSelectedRoles([]);
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('admin.notifications.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('admin.notifications.notificationTitle')}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('admin.notifications.titlePlaceholder')} maxLength={100} />
          </div>
          <div>
            <Label>{t('admin.notifications.notificationBody')}</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder={t('admin.notifications.bodyPlaceholder')} rows={4} maxLength={500} />
          </div>
          <div>
            <Label className="mb-2 block">{t('admin.notifications.sendTo')}</Label>
            <div className="flex flex-wrap gap-4">
              {ROLE_IDS.map(role => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={selectedRoles.includes(role)} onCheckedChange={() => toggleRole(role)} />
                  <span className="text-sm">{roleLabels[role]}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={selectedRoles.length === ROLE_IDS.length} onCheckedChange={selectAll} />
                <span className="text-sm font-medium">{t('admin.notifications.all')}</span>
              </label>
            </div>
          </div>
          <Button onClick={handleSend} disabled={sending || !title.trim() || !body.trim() || selectedRoles.length === 0} className="w-full sm:w-auto">
            <Send className="h-4 w-4 me-2" />
            {sending ? t('admin.notifications.sending') : t('admin.notifications.sendNow')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomNotifications;
