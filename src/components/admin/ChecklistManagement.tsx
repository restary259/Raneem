import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ChecklistManagementProps { items: any[]; onRefresh: () => void; }

const ChecklistManagement: React.FC<ChecklistManagementProps> = ({ items, onRefresh }) => {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const maxOrder = items.reduce((max, i) => Math.max(max, i.sort_order || 0), 0);
    const { error } = await (supabase as any).from('checklist_items').insert({ item_name: newName.trim(), description: newDesc.trim() || null, sort_order: maxOrder + 1 });
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { setNewName(''); setNewDesc(''); toast({ title: t('admin.checklistMgmt.added') }); onRefresh(); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await (supabase as any).from('checklist_items').delete().eq('id', deleteId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { toast({ title: t('admin.checklistMgmt.deleted') }); onRefresh(); }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">{t('admin.checklistMgmt.addNew')}</h3>
          <div className="flex flex-wrap gap-3">
            <Input className="flex-1 min-w-[200px]" placeholder={t('admin.checklistMgmt.namePlaceholder')} value={newName} onChange={e => setNewName(e.target.value)} />
            <Input className="flex-1 min-w-[200px]" placeholder={t('admin.checklistMgmt.descPlaceholder')} value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            <Button onClick={handleAdd} disabled={!newName.trim()}><Plus className="h-4 w-4 me-2" />{t('admin.checklistMgmt.add')}</Button>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {items.sort((a, b) => a.sort_order - b.sort_order).map((item, index) => (
          <div key={item.id} className="flex items-center gap-3 bg-background rounded-xl border p-4 hover:shadow-sm transition-shadow">
            <GripVertical className="h-5 w-5 text-muted-foreground/50 shrink-0" />
            <div className="flex-1"><p className="font-medium text-sm">{item.item_name}</p>{item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}</div>
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="text-center text-muted-foreground py-8">{t('admin.checklistMgmt.noItems')}</p>}

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

export default ChecklistManagement;
