import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, RefreshCw, BookOpen, Home, Clock, BadgeCheck, Pause, Play } from 'lucide-react';

interface Program {
  id: string;
  name_ar: string;
  name_en: string;
  type: string;
  price: number | null;
  currency: string;
  duration: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Accommodation {
  id: string;
  name_ar: string;
  name_en: string;
  price: number | null;
  currency: string;
  description: string | null;
  is_active: boolean;
}

const PROGRAM_TYPES = ['language_school', 'course', 'university', 'other'];

const AdminProgramsPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const isRtl = i18n.language === 'ar';

  const [programs, setPrograms] = useState<Program[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [progOpen, setProgOpen] = useState(false);
  const [accomOpen, setAccomOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [progForm, setProgForm] = useState({ name_ar: '', name_en: '', type: 'language_school', price: '', currency: 'ILS', duration: '', description: '' });
  const [accomForm, setAccomForm] = useState({ name_ar: '', name_en: '', price: '', currency: 'ILS', description: '' });

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, aRes] = await Promise.all([
        supabase.from('programs').select('*').order('created_at', { ascending: false }),
        supabase.from('accommodations').select('*').order('created_at', { ascending: false }),
      ]);
      if (pRes.error) throw pRes.error;
      if (aRes.error) throw aRes.error;
      setPrograms(pRes.data || []);
      setAccommodations(aRes.data || []);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createProgram = async () => {
    if (!progForm.name_ar || !progForm.name_en) { toast({ variant: 'destructive', description: isRtl ? 'الاسم مطلوب' : 'Name is required' }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('programs').insert({
        name_ar: progForm.name_ar,
        name_en: progForm.name_en,
        type: progForm.type,
        price: progForm.price ? Number(progForm.price) : null,
        currency: progForm.currency,
        duration: progForm.duration || null,
        description: progForm.description || null,
      });
      if (error) throw error;
      setProgForm({ name_ar: '', name_en: '', type: 'language_school', price: '', currency: 'ILS', duration: '', description: '' });
      setProgOpen(false);
      await fetchAll();
      toast({ description: isRtl ? 'تم إنشاء البرنامج' : 'Program created' });
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const createAccom = async () => {
    if (!accomForm.name_ar || !accomForm.name_en) { toast({ variant: 'destructive', description: isRtl ? 'الاسم مطلوب' : 'Name is required' }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('accommodations').insert({
        name_ar: accomForm.name_ar,
        name_en: accomForm.name_en,
        price: accomForm.price ? Number(accomForm.price) : null,
        currency: accomForm.currency,
        description: accomForm.description || null,
      });
      if (error) throw error;
      setAccomForm({ name_ar: '', name_en: '', price: '', currency: 'ILS', description: '' });
      setAccomOpen(false);
      await fetchAll();
      toast({ description: isRtl ? 'تم إنشاء السكن' : 'Accommodation created' });
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (table: 'programs' | 'accommodations', id: string, current: boolean) => {
    const { error } = await supabase.from(table).update({ is_active: !current }).eq('id', id);
    if (error) toast({ variant: 'destructive', description: error.message });
    else fetchAll();
  };

  const deleteRecord = async (table: 'programs' | 'accommodations', id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) toast({ variant: 'destructive', description: error.message });
    else fetchAll();
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = { language_school: 'Language School', course: 'Course', university: 'University', other: 'Other' };
    return map[type] || type;
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('admin.programs.title', 'Programs & Accommodations')}</h1>
        <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">{t('admin.programs.programs', 'Programs')}</TabsTrigger>
          <TabsTrigger value="accommodations">{t('admin.programs.accommodations', 'Accommodations')}</TabsTrigger>
        </TabsList>

        {/* ── Programs ── */}
        <TabsContent value="programs" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={progOpen} onOpenChange={setProgOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />{t('admin.programs.addProgram', 'Add Program')}</Button>
              </DialogTrigger>
              <DialogContent dir={isRtl ? 'rtl' : 'ltr'}>
                <DialogHeader><DialogTitle>{t('admin.programs.addProgram', 'Add Program')}</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>{isRtl ? 'الاسم بالعربية' : 'Arabic Name'}</Label><Input value={progForm.name_ar} onChange={e => setProgForm(f => ({ ...f, name_ar: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>{isRtl ? 'الاسم بالإنجليزية' : 'English Name'}</Label><Input value={progForm.name_en} onChange={e => setProgForm(f => ({ ...f, name_en: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.programs.type', 'Type')}</Label>
                    <Select value={progForm.type} onValueChange={v => setProgForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PROGRAM_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>{t('admin.programs.price', 'Price')}</Label><Input type="number" value={progForm.price} onChange={e => setProgForm(f => ({ ...f, price: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>{t('admin.programs.duration', 'Duration')}</Label><Input value={progForm.duration} onChange={e => setProgForm(f => ({ ...f, duration: e.target.value }))} /></div>
                  </div>
                  <Button className="w-full" onClick={createProgram} disabled={saving}>{saving ? '...' : t('common.save', 'Save')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : programs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{isRtl ? 'لا توجد برامج' : 'No programs yet'}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {programs.map(p => (
                <Card key={p.id} className={`overflow-hidden transition-all hover:shadow-md ${!p.is_active ? 'opacity-60' : ''}`}>
                  <CardContent className="p-0">
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground leading-tight truncate">{p.name_en}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.name_ar}</p>
                          </div>
                        </div>
                        <Badge variant={p.is_active ? 'default' : 'secondary'} className="shrink-0 text-xs">
                          {p.is_active ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معطل' : 'Inactive')}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          <BadgeCheck className="h-3 w-3" />{typeLabel(p.type)}
                        </span>
                        {p.price && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            💰 {p.price.toLocaleString()} {p.currency}
                          </span>
                        )}
                        {p.duration && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                            <Clock className="h-3 w-3" />{p.duration}
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-1 border-t bg-muted/30 px-3 py-2">
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => toggleActive('programs', p.id, p.is_active)}>
                        {p.is_active ? <><Pause className="h-3 w-3" />{isRtl ? 'إيقاف' : 'Pause'}</> : <><Play className="h-3 w-3" />{isRtl ? 'تفعيل' : 'Activate'}</>}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteRecord('programs', p.id)}>
                        <Trash2 className="h-3 w-3" />{isRtl ? 'حذف' : 'Delete'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Accommodations ── */}
        <TabsContent value="accommodations" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={accomOpen} onOpenChange={setAccomOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />{t('admin.programs.addAccommodation', 'Add Accommodation')}</Button>
              </DialogTrigger>
              <DialogContent dir={isRtl ? 'rtl' : 'ltr'}>
                <DialogHeader><DialogTitle>{t('admin.programs.addAccommodation', 'Add Accommodation')}</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>{isRtl ? 'الاسم بالعربية' : 'Arabic Name'}</Label><Input value={accomForm.name_ar} onChange={e => setAccomForm(f => ({ ...f, name_ar: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>{isRtl ? 'الاسم بالإنجليزية' : 'English Name'}</Label><Input value={accomForm.name_en} onChange={e => setAccomForm(f => ({ ...f, name_en: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-1"><Label>{t('admin.programs.price', 'Price')} (ILS)</Label><Input type="number" value={accomForm.price} onChange={e => setAccomForm(f => ({ ...f, price: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>{t('admin.programs.description', 'Description')}</Label><Input value={accomForm.description} onChange={e => setAccomForm(f => ({ ...f, description: e.target.value }))} /></div>
                  <Button className="w-full" onClick={createAccom} disabled={saving}>{saving ? '...' : t('common.save', 'Save')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0">
            {loading ? <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div> :
              accommodations.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">{isRtl ? 'لا يوجد سكن' : 'No accommodations yet'}</div> :
              <div className="divide-y divide-border">
                {accommodations.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">{isRtl ? a.name_ar : a.name_en}</p>
                      <p className="text-xs text-muted-foreground">{a.price ? `${a.price} ${a.currency}` : t('admin.programs.freePrice', 'Free')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.is_active ? 'default' : 'secondary'}>{a.is_active ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معطل' : 'Inactive')}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => toggleActive('accommodations', a.id, a.is_active)}><span className="text-xs">{a.is_active ? '⏸' : '▶'}</span></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteRecord('accommodations', a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminProgramsPage;
