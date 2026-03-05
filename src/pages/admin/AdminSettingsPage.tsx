import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Save, Plus, Trash2, Phone, Mail, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PlatformSettings {
  id: string;
  partner_commission_rate: number;
  forgotten_new_case_days: number;
  forgotten_contacted_days: number;
}

interface Contact {
  id: string;
  name_ar: string;
  name_en: string;
  role_ar: string | null;
  role_en: string | null;
  phone: string | null;
  email: string | null;
  link: string | null;
  category: string;
  display_order: number;
  is_active: boolean;
}

const CATEGORIES = ['emergency', 'medical', 'legal', 'team', 'other'];

const AdminSettingsPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';

  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);

  const [contactForm, setContactForm] = useState({
    name_ar: '', name_en: '', role_ar: '', role_en: '', phone: '', email: '', link: '', category: 'other', display_order: '0',
  });

  const fetchData = useCallback(async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        supabase.from('platform_settings').select('*').limit(1).single(),
        supabase.from('important_contacts').select('*').order('display_order'),
      ]);
      if (sRes.data) setSettings(sRes.data);
      setContacts(cRes.data || []);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('platform_settings').update({
        partner_commission_rate: settings.partner_commission_rate,
        forgotten_new_case_days: settings.forgotten_new_case_days,
        forgotten_contacted_days: settings.forgotten_contacted_days,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }).eq('id', settings.id);
      if (error) throw error;
      toast({ description: isRtl ? 'تم حفظ الإعدادات' : 'Settings saved' });
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const createContact = async () => {
    if (!contactForm.name_ar || !contactForm.name_en) {
      toast({ variant: 'destructive', description: isRtl ? 'الاسم مطلوب' : 'Name is required' });
      return;
    }
    setContactSaving(true);
    try {
      const { error } = await supabase.from('important_contacts').insert({
        name_ar: contactForm.name_ar,
        name_en: contactForm.name_en,
        role_ar: contactForm.role_ar || null,
        role_en: contactForm.role_en || null,
        phone: contactForm.phone || null,
        email: contactForm.email || null,
        link: contactForm.link || null,
        category: contactForm.category,
        display_order: Number(contactForm.display_order) || 0,
      });
      if (error) throw error;
      setContactForm({ name_ar: '', name_en: '', role_ar: '', role_en: '', phone: '', email: '', link: '', category: 'other', display_order: '0' });
      setContactOpen(false);
      await fetchData();
      toast({ description: isRtl ? 'تم إنشاء جهة الاتصال' : 'Contact created' });
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setContactSaving(false);
    }
  };

  const toggleContact = async (id: string, current: boolean) => {
    const { error } = await supabase.from('important_contacts').update({ is_active: !current }).eq('id', id);
    if (error) toast({ variant: 'destructive', description: error.message });
    else fetchData();
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from('important_contacts').delete().eq('id', id);
    if (error) toast({ variant: 'destructive', description: error.message });
    else fetchData();
  };

  const catLabel = (cat: string) => {
    const m: Record<string, { en: string; ar: string }> = {
      emergency: { en: 'Emergency', ar: 'طوارئ' },
      medical: { en: 'Medical', ar: 'طبي' },
      legal: { en: 'Legal', ar: 'قانوني' },
      team: { en: 'Team', ar: 'الفريق' },
      other: { en: 'Other', ar: 'أخرى' },
    };
    return isRtl ? m[cat]?.ar : m[cat]?.en;
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">{isRtl ? 'جار التحميل...' : 'Loading...'}</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('admin.settings.title', 'Settings')}</h1>
        <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <Tabs defaultValue="platform">
        <TabsList>
          <TabsTrigger value="platform">{t('admin.settings.platform', 'Platform')}</TabsTrigger>
          <TabsTrigger value="contacts">{t('admin.settings.contacts', 'Important Contacts')}</TabsTrigger>
        </TabsList>

        {/* ── Platform Settings ── */}
        <TabsContent value="platform" className="space-y-4 mt-4">
          {settings && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t('admin.settings.platformTitle', 'Platform Configuration')}</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1">
                  <Label>{isRtl ? 'معدل عمولة الشريك (ILS / طالب)' : 'Partner Commission Rate (ILS / student)'}</Label>
                  <Input
                    type="number"
                    value={settings.partner_commission_rate}
                    onChange={e => setSettings(s => s ? { ...s, partner_commission_rate: Number(e.target.value) } : s)}
                  />
                  <p className="text-xs text-muted-foreground">{isRtl ? 'المبلغ المستحق للشريك عن كل طالب مسجل' : 'Amount owed to partner per enrolled student'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>{isRtl ? 'أيام الحالة الجديدة قبل أن تُنسى' : 'New Case Forgotten Days'}</Label>
                    <Input
                      type="number"
                      value={settings.forgotten_new_case_days}
                      onChange={e => setSettings(s => s ? { ...s, forgotten_new_case_days: Number(e.target.value) } : s)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{isRtl ? 'أيام حالة "تم التواصل" قبل أن تُنسى' : 'Contacted Case Forgotten Days'}</Label>
                    <Input
                      type="number"
                      value={settings.forgotten_contacted_days}
                      onChange={e => setSettings(s => s ? { ...s, forgotten_contacted_days: Number(e.target.value) } : s)}
                    />
                  </div>
                </div>
                <Button onClick={saveSettings} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? (isRtl ? 'جار الحفظ...' : 'Saving...') : t('common.save', 'Save Changes')}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Important Contacts ── */}
        <TabsContent value="contacts" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={contactOpen} onOpenChange={setContactOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />{t('admin.settings.addContact', 'Add Contact')}</Button>
              </DialogTrigger>
              <DialogContent dir={isRtl ? 'rtl' : 'ltr'} className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{t('admin.settings.addContact', 'Add Contact')}</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>{isRtl ? 'الاسم عربي' : 'Arabic Name'}</Label><Input value={contactForm.name_ar} onChange={e => setContactForm(f => ({ ...f, name_ar: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>{isRtl ? 'الاسم إنجليزي' : 'English Name'}</Label><Input value={contactForm.name_en} onChange={e => setContactForm(f => ({ ...f, name_en: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>{isRtl ? 'الدور عربي' : 'Role AR'}</Label><Input value={contactForm.role_ar} onChange={e => setContactForm(f => ({ ...f, role_ar: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>{isRtl ? 'الدور إنجليزي' : 'Role EN'}</Label><Input value={contactForm.role_en} onChange={e => setContactForm(f => ({ ...f, role_en: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-1"><Label>{isRtl ? 'الهاتف' : 'Phone'}</Label><Input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>{isRtl ? 'البريد الإلكتروني' : 'Email'}</Label><Input value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>{isRtl ? 'الرابط' : 'Link'}</Label><Input value={contactForm.link} onChange={e => setContactForm(f => ({ ...f, link: e.target.value }))} /></div>
                  <div className="space-y-1">
                    <Label>{isRtl ? 'الفئة' : 'Category'}</Label>
                    <Select value={contactForm.category} onValueChange={v => setContactForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>{isRtl ? 'الترتيب' : 'Display Order'}</Label><Input type="number" value={contactForm.display_order} onChange={e => setContactForm(f => ({ ...f, display_order: e.target.value }))} /></div>
                  <Button className="w-full" onClick={createContact} disabled={contactSaving}>{contactSaving ? '...' : t('common.save', 'Save')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card><CardContent className="p-0">
            {contacts.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{isRtl ? 'لا توجد جهات اتصال' : 'No contacts yet'}</p>
            ) : (
              <div className="divide-y divide-border">
                {contacts.map(c => (
                  <div key={c.id} className="flex items-start justify-between p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{isRtl ? c.name_ar : c.name_en}</p>
                      {(isRtl ? c.role_ar : c.role_en) && <p className="text-xs text-muted-foreground">{isRtl ? c.role_ar : c.role_en}</p>}
                      <div className="flex flex-wrap gap-3 mt-1">
                        {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline"><Phone className="h-3 w-3" />{c.phone}</a>}
                        {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-primary hover:underline"><Mail className="h-3 w-3" />{c.email}</a>}
                        {c.link && <a href={c.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline"><LinkIcon className="h-3 w-3" />Link</a>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ms-4 shrink-0">
                      <span className="text-xs text-muted-foreground">{catLabel(c.category)}</span>
                      <Switch checked={c.is_active} onCheckedChange={() => toggleContact(c.id, c.is_active)} />
                      <Button variant="ghost" size="icon" onClick={() => deleteContact(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettingsPage;
