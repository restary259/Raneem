import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ChecklistTrackerProps {
  userId: string;
}

const ChecklistTracker: React.FC<ChecklistTrackerProps> = ({ userId }) => {
  const [items, setItems] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    const [itemsRes, completionsRes] = await Promise.all([
      (supabase as any).from('checklist_items').select('*').order('sort_order', { ascending: true }),
      (supabase as any).from('student_checklist').select('*').eq('student_id', userId),
    ]);
    if (itemsRes.data) setItems(itemsRes.data);
    if (completionsRes.data) setCompletions(completionsRes.data);
    setIsLoading(false);
  };

  const toggleItem = async (itemId: string, currentlyCompleted: boolean) => {
    const existing = completions.find(c => c.checklist_item_id === itemId);

    if (existing) {
      await (supabase as any).from('student_checklist').update({
        is_completed: !currentlyCompleted,
        completed_at: !currentlyCompleted ? new Date().toISOString() : null,
      }).eq('id', existing.id);
    } else {
      await (supabase as any).from('student_checklist').insert({
        student_id: userId,
        checklist_item_id: itemId,
        is_completed: true,
        completed_at: new Date().toISOString(),
      });
    }

    await fetchData();
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const completedCount = items.filter(item => completions.find(c => c.checklist_item_id === item.id && c.is_completed)).length;
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 2.64} 264`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold">{progress}%</span>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                {t('checklist.title')}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {t('checklist.progress', { completed: completedCount, total: items.length })}
              </p>
              {progress === 100 && (
                <p className="text-emerald-600 font-semibold text-sm mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />{t('checklist.allComplete')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.map((item) => {
          const completion = completions.find(c => c.checklist_item_id === item.id);
          const isCompleted = completion?.is_completed || false;

          return (
            <Card
              key={item.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                isCompleted ? 'bg-emerald-50/50 border-emerald-200' : ''
              }`}
              onClick={() => toggleItem(item.id, isCompleted)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <Checkbox checked={isCompleted} className="h-5 w-5" />
                <div className="flex-1">
                  <p className={`font-medium text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                    {item.item_name}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                </div>
                {isCompleted && completion?.completed_at && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(completion.completed_at).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-US')}
                  </span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {items.length === 0 && (
        <p className="text-center text-muted-foreground py-8">{t('checklist.noItems')}</p>
      )}
    </div>
  );
};

export default ChecklistTracker;
