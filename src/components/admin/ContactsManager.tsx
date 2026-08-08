import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ContactsManagerProps {
  /** Already filtered by the page toolbar (search + tab). */
  contacts: any[];
  onRefresh: () => void;
}

const ContactsManager: React.FC<ContactsManagerProps> = ({ contacts, onRefresh }) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const updateStatus = async (id: string, status: string) => {
    await (supabase as any).from('contact_submissions').update({ status }).eq('id', id);
    toast({ title: t('admin.contacts.statusUpdated') }); onRefresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await (supabase as any).from('contact_submissions').delete().eq('id', deleteId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { toast({ title: t('admin.shared.deleted') }); onRefresh(); }
    setDeleteId(null);
  };

  const humanize = (key: string) =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

  const fieldLabel = (key: string) => t(`admin.contacts.fields.${key}`, humanize(key));

  const fieldValue = (value: any) => {
    if (typeof value === 'boolean') return value ? t('admin.contacts.values.yes') : t('admin.contacts.values.no');
    const s = String(value);
    if (s === 'true' || s === 'yes') return t('admin.contacts.values.yes');
    if (s === 'false' || s === 'no') return t('admin.contacts.values.no');
    return s;
  };

  const sourceLabel = (source?: string) =>
    (source || '').toLowerCase().includes('partner')
      ? t('admin.contacts.sourcePartnership')
      : t('admin.contacts.sourceContact');

  const statusLabel = (status: string) =>
    status === 'new'
      ? t('admin.contacts.new')
      : status === 'replied'
        ? t('admin.contacts.replied')
        : t('admin.contacts.archived');

  return (
    <div className="space-y-3">
      {contacts.map(c => (
        <Card key={c.id} className={c.status === 'new' ? 'border-primary/40 bg-muted/30' : ''}>
          <CardContent className="pt-4">
            <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
              <div className="min-w-0">
                <h3 className="font-bold">{c.data?.name || c.data?.full_name || t('admin.contacts.noName')}</h3>
                <p className="text-sm text-muted-foreground break-words">{c.data?.email} • {c.data?.whatsapp || c.data?.phone || '—'}</p>
                <Badge variant="outline" className="mt-1">{sourceLabel(c.form_source)}</Badge>
              </div>
              <div className="flex items-center gap-2 ms-auto">
                <Badge variant={c.status === 'new' ? 'destructive' : c.status === 'replied' ? 'default' : 'secondary'}>
                  {statusLabel(c.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">{c.created_at?.split('T')[0]}</span>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {c.data && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2 text-sm bg-muted/40 p-3 rounded-lg">
                {Object.entries(c.data as Record<string, any>)
                  .filter(([k, v]) => !['name', 'full_name', 'email', 'whatsapp', 'phone'].includes(k) && v !== null && v !== undefined && String(v).trim() !== '')
                  .map(([k, v]) => (
                    <div key={k} className="break-words">
                      <span className="text-muted-foreground">{fieldLabel(k)}: </span>
                      <span className="font-medium">{fieldValue(v)}</span>
                    </div>
                  ))}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              {c.status === 'new' && <Button size="sm" onClick={() => updateStatus(c.id, 'replied')}>{t('admin.contacts.markReplied')}</Button>}
              {c.status !== 'archived' && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, 'archived')}>{t('admin.contacts.archive')}</Button>}
            </div>
          </CardContent>
        </Card>
      ))}
      {contacts.length === 0 && <p className="p-10 text-center text-muted-foreground">{t('admin.contacts.noMessages')}</p>}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.shared.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.shared.deleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.shared.cancelBtn')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('admin.shared.deleteBtn')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContactsManager;
