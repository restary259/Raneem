import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface ChecklistManagementProps {
  items: any[];
  onRefresh: () => void;
}

const ChecklistManagement: React.FC<ChecklistManagementProps> = ({ items, onRefresh }) => {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const maxOrder = items.reduce((max, i) => Math.max(max, i.sort_order || 0), 0);
    const { error } = await (supabase as any).from('checklist_items').insert({
      item_name: newName.trim(),
      description: newDesc.trim() || null,
      sort_order: maxOrder + 1,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } else {
      setNewName('');
      setNewDesc('');
      toast({ title: 'تمت الإضافة' });
      onRefresh();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from('checklist_items').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } else {
      toast({ title: 'تم الحذف' });
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">إضافة عنصر جديد</h3>
          <div className="flex flex-wrap gap-3">
            <Input className="flex-1 min-w-[200px]" placeholder="اسم العنصر (مثلاً: جواز السفر)" value={newName} onChange={e => setNewName(e.target.value)} />
            <Input className="flex-1 min-w-[200px]" placeholder="وصف اختياري" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            <Button onClick={handleAdd} disabled={!newName.trim()}><Plus className="h-4 w-4 me-2" />إضافة</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.sort((a, b) => a.sort_order - b.sort_order).map((item, index) => (
          <div key={item.id} className="flex items-center gap-3 bg-background rounded-xl border p-4 hover:shadow-sm transition-shadow">
            <GripVertical className="h-5 w-5 text-muted-foreground/50 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">{item.item_name}</p>
              {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
            </div>
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد عناصر بعد</p>}
    </div>
  );
};

export default ChecklistManagement;
