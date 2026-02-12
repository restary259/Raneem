import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Search, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ContactsManagerProps { contacts: any[]; onRefresh: () => void; }
const downloadCSV = (rows: any[], fileName = "export.csv") => { if (!rows.length) return; const header = Object.keys(rows[0]); const csv = [header.join(","), ...rows.map(row => header.map(f => `"${String(row[f] ?? "").replace(/"/g, '""')}"`).join(","))].join("\r\n"); const blob = new Blob([csv], { type: "text/csv" }); const url = window.URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = fileName; a.click(); window.URL.revokeObjectURL(url); };

const ContactsManager: React.FC<ContactsManagerProps> = ({ contacts, onRefresh }) => {
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const updateStatus = async (id: string, status: string) => {
    await (supabase as any).from('contact_submissions').update({ status }).eq('id', id);
    toast({ title: t('admin.contacts.statusUpdated') }); onRefresh();
  };

  const filtered = contacts.filter(c => !search || c.data?.name?.toLowerCase().includes(search.toLowerCase()) || c.data?.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="ps-10" placeholder={t('admin.contacts.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadCSV(contacts.map(c => ({ ...c.data, status: c.status, date: c.created_at })), 'contacts.csv')}>
          <Download className="h-4 w-4 me-2" />{t('admin.contacts.export')}
        </Button>
      </div>
      <div className="space-y-3">
        {filtered.map(c => (
          <Card key={c.id} className={c.status === 'new' ? 'border-amber-300 bg-amber-50/30' : ''}>
            <CardContent className="pt-4">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                <div><h3 className="font-bold">{c.data?.name || t('admin.contacts.noName')}</h3><p className="text-sm text-muted-foreground">{c.data?.email} • {c.data?.whatsapp || '—'}</p></div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === 'new' ? 'destructive' : c.status === 'replied' ? 'default' : 'secondary'}>
                    {c.status === 'new' ? t('admin.contacts.new') : c.status === 'replied' ? t('admin.contacts.replied') : c.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{c.created_at?.split('T')[0]}</span>
                </div>
              </div>
              {c.data?.message && <p className="text-sm bg-muted/50 p-3 rounded-lg mt-2">{c.data.message}</p>}
              <div className="mt-3 flex gap-2">
                {c.status === 'new' && <Button size="sm" onClick={() => updateStatus(c.id, 'replied')}>{t('admin.contacts.markReplied')}</Button>}
                {c.status !== 'archived' && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, 'archived')}>{t('admin.contacts.archive')}</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.contacts.noMessages')}</p>}
      </div>
    </div>
  );
};

export default ContactsManager;
