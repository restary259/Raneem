import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, CheckCircle2, Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadingState, EmptyState, ErrorState, TablePagination, usePagination } from '@/components/shell';
import { toneClasses } from '@/lib/statusTokens';
import ChecklistItemUploadDialog, {
  type ChecklistUploadTarget,
} from '@/components/dashboard/ChecklistItemUploadDialog';

interface ChecklistTrackerProps {
  userId: string;
}

interface UploadedDocument {
  id: string;
  file_name: string;
  checklist_item_id: string;
}

const ChecklistTracker: React.FC<ChecklistTrackerProps> = ({ userId }) => {
  const [items, setItems] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [uploads, setUploads] = useState<UploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [target, setTarget] = useState<ChecklistUploadTarget | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    fetchData(ignore);
    return () => {
      ignore = true;
    };
  }, [userId]);

  const fetchData = async (ignore = false) => {
    const [itemsRes, completionsRes, uploadsRes] = await Promise.all([
      (supabase as any).from('checklist_items').select('*').order('sort_order', { ascending: true }),
      (supabase as any).from('student_checklist').select('*').eq('student_id', userId),
      // Documents the student uploaded from a checklist popup, so each row can
      // show that its file is already attached. Ad-hoc uploads have a NULL
      // checklist_item_id and are filtered out by the `.not` below.
      // `.is('deleted_at', null)` matters: staff delete marks the row rather
      // than removing it, so without this a removed file would still render as
      // attached. Newest first, so a replacement upload wins over the original.
      (supabase as any)
        .from('documents')
        .select('id, file_name, checklist_item_id')
        .eq('student_id', userId)
        .not('checklist_item_id', 'is', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ]);
    if (ignore) return;
    if (itemsRes.error || completionsRes.error) {
      setLoadError((itemsRes.error || completionsRes.error)?.message ?? t('common.error', 'Error'));
    } else {
      setLoadError(null);
    }
    if (itemsRes.data) setItems(itemsRes.data);
    if (completionsRes.data) setCompletions(completionsRes.data);
    if (uploadsRes.data) setUploads(uploadsRes.data as UploadedDocument[]);
    setIsLoading(false);
  };

  const handleItemClick = (itemId: string, itemName: string, currentlyCompleted: boolean) => {
    const existing = uploads.find((u) => u.checklist_item_id === itemId);
    setTarget({
      id: itemId,
      name: itemName,
      completed: currentlyCompleted,
      existingDocument: existing ? { id: existing.id, file_name: existing.file_name } : null,
    });
  };

  /**
   * Uncheck path: clears completion only. The uploaded file is never deleted.
   * Returns `false` on failure so the popup stays open for a retry.
   */
  const handleUncheck = async (itemId: string): Promise<boolean> => {
    const existing = completions.find(c => c.checklist_item_id === itemId);
    if (!existing) return true;
    const prevCompletions = completions;
    const { error } = await (supabase as any)
      .from('student_checklist')
      .update({ is_completed: false, completed_at: null })
      .eq('id', existing.id);
    if (error) {
      toast({ variant: 'destructive', title: t('common.error', 'Error'), description: error.message });
      setCompletions(prevCompletions);
      return false;
    }
    await fetchData();
    return true;
  };

  if (isLoading) {
    return <LoadingState variant="rows" rows={5} />;
  }

  if (loadError && items.length === 0) {
    return (
      <ErrorState
        title={t('common.error', 'Error')}
        description={loadError}
        onRetry={() => fetchData()}
        retryLabel={t('common.retry', 'Retry')}
      />
    );
  }

  const completedCount = items.filter(item => completions.find(c => c.checklist_item_id === item.id && c.is_completed)).length;
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          {/* `min-w-0` on the text column: the progress line is a single
              translated sentence, and without it this flex child refuses to
              shrink below its min-content width, pushing the row (and the
              card) past the viewport in the longer locales. */}
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
            <div className="min-w-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0 break-words">{t('checklist.title')}</span>
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {t('checklist.progress', { completed: completedCount, total: items.length })}
              </p>
              {progress === 100 && (
                <p className={`${toneClasses('enrolled').text} font-semibold text-sm mt-2 flex items-center gap-1`}>
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
          const upload = uploads.find(u => u.checklist_item_id === item.id);

          return (
            <Card
              key={item.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                isCompleted ? `${toneClasses('enrolled').tint} border-[hsl(var(--status-enrolled)/0.3)]` : 'hover:bg-muted/40'
              }`}
              onClick={() => handleItemClick(item.id, item.item_name, isCompleted)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <Checkbox checked={isCompleted} className="h-5 w-5" />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                    {item.item_name}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                  {upload && (
                    <p className="text-xs text-primary mt-1 flex items-center gap-1 min-w-0">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{upload.file_name}</span>
                    </p>
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

      {items.length === 0 && <EmptyState title={t('checklist.noItems')} />}

      <ChecklistItemUploadDialog
        studentId={userId}
        target={target}
        onClose={() => setTarget(null)}
        onChanged={() => fetchData()}
        onUncheck={handleUncheck}
      />
    </div>
  );
};

export default ChecklistTracker;
