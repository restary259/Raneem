import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, GraduationCap, FolderOpen, Loader2, Download } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface MajorCategory {
  id: string;
  title_ar: string;
  title_en: string;
  sort_order: number;
  is_active: boolean;
}

interface Major {
  id: string;
  category_id: string;
  name_ar: string;
  name_en: string;
  name_de?: string;
  description_ar?: string;
  description_en?: string;
  duration_ar?: string;
  duration_en?: string;
  suitable_for_ar?: string;
  suitable_for_en?: string;
  required_background_ar?: string;
  required_background_en?: string;
  language_requirements_ar?: string;
  language_requirements_en?: string;
  career_opportunities_ar?: string;
  career_opportunities_en?: string;
  arab48_notes_ar?: string;
  arab48_notes_en?: string;
  sort_order: number;
  is_active: boolean;
}

const emptyMajor: Omit<Major, 'id'> = {
  category_id: '',
  name_ar: '', name_en: '', name_de: '',
  description_ar: '', description_en: '',
  duration_ar: '', duration_en: '',
  suitable_for_ar: '', suitable_for_en: '',
  required_background_ar: '', required_background_en: '',
  language_requirements_ar: '', language_requirements_en: '',
  career_opportunities_ar: '', career_opportunities_en: '',
  arab48_notes_ar: '', arab48_notes_en: '',
  sort_order: 0, is_active: true,
};

const MajorsManagement: React.FC = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const isAr = i18n.language === 'ar';

  const [categories, setCategories] = useState<MajorCategory[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Category modal
  const [catModal, setCatModal] = useState<{ open: boolean; edit?: MajorCategory }>({ open: false });
  const [catForm, setCatForm] = useState({ title_ar: '', title_en: '', sort_order: 0 });

  // Major modal
  const [majorModal, setMajorModal] = useState<{ open: boolean; edit?: Major }>({ open: false });
  const [majorForm, setMajorForm] = useState<Omit<Major, 'id'>>(emptyMajor);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'major'; id: string; name: string } | null>(null);

  useEffect(() => { fetchData(); }, []);

  const safeQuery = (p: Promise<any>) => p.catch(err => ({ data: null, error: err }));

  const fetchData = async () => {
    setLoading(true);
    const [catsRes, majorsRes] = await Promise.all([
      safeQuery((supabase as any).from('major_categories').select('*').order('sort_order')),
      safeQuery((supabase as any).from('majors').select('*').order('sort_order')),
    ]);
    if (catsRes.error) console.error('Categories fetch failed:', catsRes.error);
    if (catsRes.data) setCategories(catsRes.data);
    if (majorsRes.error) console.error('Majors fetch failed:', majorsRes.error);
    if (majorsRes.data) setMajors(majorsRes.data);
    setLoading(false);
  };

  const seedData = async () => {
    setSeeding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-majors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      });
      const result = await resp.json();
      if (resp.ok) {
        toast({ title: 'Seeded successfully', description: `${result.categories} categories, ${result.majors} majors` });
        await fetchData();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || result.message });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
    setSeeding(false);
  };

  // Category CRUD
  const openCatModal = (cat?: MajorCategory) => {
    if (cat) {
      setCatForm({ title_ar: cat.title_ar, title_en: cat.title_en, sort_order: cat.sort_order });
      setCatModal({ open: true, edit: cat });
    } else {
      setCatForm({ title_ar: '', title_en: '', sort_order: categories.length });
      setCatModal({ open: true });
    }
  };

  const saveCat = async () => {
    if (!catForm.title_ar || !catForm.title_en) return;
    if (catModal.edit) {
      const { error } = await (supabase as any).from('major_categories').update(catForm).eq('id', catModal.edit.id);
      if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    } else {
      const { error } = await (supabase as any).from('major_categories').insert(catForm);
      if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    }
    toast({ title: catModal.edit ? 'Category updated' : 'Category added' });
    setCatModal({ open: false });
    fetchData();
  };

  // Major CRUD
  const openMajorModal = (major?: Major, catId?: string) => {
    if (major) {
      const { id, ...rest } = major;
      setMajorForm(rest);
      setMajorModal({ open: true, edit: major });
    } else {
      setMajorForm({ ...emptyMajor, category_id: catId || categories[0]?.id || '', sort_order: majors.filter(m => m.category_id === catId).length });
      setMajorModal({ open: true });
    }
  };

  const saveMajor = async () => {
    if (!majorForm.name_ar || !majorForm.name_en || !majorForm.category_id) return;
    if (majorModal.edit) {
      const { error } = await (supabase as any).from('majors').update(majorForm).eq('id', majorModal.edit.id);
      if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    } else {
      const { error } = await (supabase as any).from('majors').insert(majorForm);
      if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    }
    toast({ title: majorModal.edit ? 'Major updated' : 'Major added' });
    setMajorModal({ open: false });
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const table = deleteTarget.type === 'category' ? 'major_categories' : 'majors';
    const { error } = await (supabase as any).from(table).delete().eq('id', deleteTarget.id);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); }
    else { toast({ title: `${deleteTarget.type === 'category' ? 'Category' : 'Major'} deleted` }); }
    setDeleteTarget(null);
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="h-6 w-6" /> Majors Management</h2>
          <p className="text-sm text-muted-foreground">{categories.length} categories, {majors.length} majors</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.length === 0 && (
            <Button variant="outline" onClick={seedData} disabled={seeding}>
              {seeding ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Download className="h-4 w-4 me-1" />}
              Seed Initial Data
            </Button>
          )}
          <Button variant="outline" onClick={() => openCatModal()}>
            <Plus className="h-4 w-4 me-1" /> Add Category
          </Button>
          <Button onClick={() => openMajorModal()}>
            <Plus className="h-4 w-4 me-1" /> Add Major
          </Button>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={categories.map(c => c.id)} className="space-y-3">
        {categories.map(cat => {
          const catMajors = majors.filter(m => m.category_id === cat.id);
          return (
            <AccordionItem key={cat.id} value={cat.id} className="border rounded-xl overflow-hidden bg-card">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-semibold">{isAr ? cat.title_ar : cat.title_en}</span>
                  <Badge variant="secondary" className="text-xs">{catMajors.length}</Badge>
                  {!cat.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Hidden</Badge>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="flex gap-2 mb-3">
                  <Button variant="ghost" size="sm" onClick={() => openCatModal(cat)}><Edit className="h-3 w-3 me-1" /> Edit Category</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget({ type: 'category', id: cat.id, name: isAr ? cat.title_ar : cat.title_en })}><Trash2 className="h-3 w-3 me-1" /> Delete</Button>
                  <Button variant="ghost" size="sm" onClick={() => openMajorModal(undefined, cat.id)}><Plus className="h-3 w-3 me-1" /> Add Major</Button>
                </div>
                {catMajors.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No majors in this category yet.</p>
                ) : (
                  <div className="grid gap-2">
                    {catMajors.sort((a, b) => a.sort_order - b.sort_order).map(major => (
                      <Card key={major.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{isAr ? major.name_ar : major.name_en}</span>
                            {major.duration_en && <Badge variant="outline" className="text-[10px] shrink-0">{isAr ? major.duration_ar : major.duration_en}</Badge>}
                            {!major.is_active && <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">Hidden</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{isAr ? major.description_ar : major.description_en}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openMajorModal(major)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget({ type: 'major', id: major.id, name: isAr ? major.name_ar : major.name_en })}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {categories.length === 0 && !loading && (
        <Card className="p-12 text-center">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No majors data yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Click "Seed Initial Data" to populate with the existing majors, or add categories and majors manually.</p>
        </Card>
      )}

      {/* Category Modal */}
      <Dialog open={catModal.open} onOpenChange={() => setCatModal({ open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{catModal.edit ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title (Arabic)</Label><Input value={catForm.title_ar} onChange={e => setCatForm(p => ({ ...p, title_ar: e.target.value }))} dir="rtl" /></div>
            <div><Label>Title (English)</Label><Input value={catForm.title_en} onChange={e => setCatForm(p => ({ ...p, title_en: e.target.value }))} /></div>
            <div><Label>Sort Order</Label><Input type="number" value={catForm.sort_order} onChange={e => setCatForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} /></div>
          </div>
          <DialogFooter><Button onClick={saveCat}>{catModal.edit ? 'Update' : 'Add'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Major Modal */}
      <Dialog open={majorModal.open} onOpenChange={() => setMajorModal({ open: false })}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{majorModal.edit ? 'Edit Major' : 'Add Major'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Category</Label>
              <Select value={majorForm.category_id} onValueChange={v => setMajorForm(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.title_en} — {c.title_ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Name (Arabic)</Label><Input value={majorForm.name_ar} onChange={e => setMajorForm(p => ({ ...p, name_ar: e.target.value }))} dir="rtl" /></div>
            <div><Label>Name (English)</Label><Input value={majorForm.name_en} onChange={e => setMajorForm(p => ({ ...p, name_en: e.target.value }))} /></div>
            <div><Label>Name (German)</Label><Input value={majorForm.name_de || ''} onChange={e => setMajorForm(p => ({ ...p, name_de: e.target.value }))} /></div>
            <div><Label>Sort Order</Label><Input type="number" value={majorForm.sort_order} onChange={e => setMajorForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} /></div>
            <div><Label>Duration (Arabic)</Label><Input value={majorForm.duration_ar || ''} onChange={e => setMajorForm(p => ({ ...p, duration_ar: e.target.value }))} dir="rtl" /></div>
            <div><Label>Duration (English)</Label><Input value={majorForm.duration_en || ''} onChange={e => setMajorForm(p => ({ ...p, duration_en: e.target.value }))} /></div>
            <div><Label>Description (Arabic)</Label><Textarea value={majorForm.description_ar || ''} onChange={e => setMajorForm(p => ({ ...p, description_ar: e.target.value }))} dir="rtl" rows={2} /></div>
            <div><Label>Description (English)</Label><Textarea value={majorForm.description_en || ''} onChange={e => setMajorForm(p => ({ ...p, description_en: e.target.value }))} rows={2} /></div>
            <div><Label>Suitable For (Arabic)</Label><Textarea value={majorForm.suitable_for_ar || ''} onChange={e => setMajorForm(p => ({ ...p, suitable_for_ar: e.target.value }))} dir="rtl" rows={2} /></div>
            <div><Label>Suitable For (English)</Label><Textarea value={majorForm.suitable_for_en || ''} onChange={e => setMajorForm(p => ({ ...p, suitable_for_en: e.target.value }))} rows={2} /></div>
            <div><Label>Required Background (Arabic)</Label><Textarea value={majorForm.required_background_ar || ''} onChange={e => setMajorForm(p => ({ ...p, required_background_ar: e.target.value }))} dir="rtl" rows={2} /></div>
            <div><Label>Required Background (English)</Label><Textarea value={majorForm.required_background_en || ''} onChange={e => setMajorForm(p => ({ ...p, required_background_en: e.target.value }))} rows={2} /></div>
            <div><Label>Language Requirements (Arabic)</Label><Textarea value={majorForm.language_requirements_ar || ''} onChange={e => setMajorForm(p => ({ ...p, language_requirements_ar: e.target.value }))} dir="rtl" rows={2} /></div>
            <div><Label>Language Requirements (English)</Label><Textarea value={majorForm.language_requirements_en || ''} onChange={e => setMajorForm(p => ({ ...p, language_requirements_en: e.target.value }))} rows={2} /></div>
            <div><Label>Career Opportunities (Arabic)</Label><Textarea value={majorForm.career_opportunities_ar || ''} onChange={e => setMajorForm(p => ({ ...p, career_opportunities_ar: e.target.value }))} dir="rtl" rows={2} /></div>
            <div><Label>Career Opportunities (English)</Label><Textarea value={majorForm.career_opportunities_en || ''} onChange={e => setMajorForm(p => ({ ...p, career_opportunities_en: e.target.value }))} rows={2} /></div>
            <div><Label>Arab48 Notes (Arabic)</Label><Textarea value={majorForm.arab48_notes_ar || ''} onChange={e => setMajorForm(p => ({ ...p, arab48_notes_ar: e.target.value }))} dir="rtl" rows={2} /></div>
            <div><Label>Arab48 Notes (English)</Label><Textarea value={majorForm.arab48_notes_en || ''} onChange={e => setMajorForm(p => ({ ...p, arab48_notes_en: e.target.value }))} rows={2} /></div>
            <div className="md:col-span-2 flex items-center gap-2">
              <Switch checked={majorForm.is_active} onCheckedChange={v => setMajorForm(p => ({ ...p, is_active: v }))} />
              <Label>Active (visible to students)</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={saveMajor}>{majorModal.edit ? 'Update' : 'Add'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
            {deleteTarget?.type === 'category' && ' This will also delete all majors in this category.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MajorsManagement;
