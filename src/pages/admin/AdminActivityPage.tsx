import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, Activity } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface ActivityEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: any;
  created_at: string;
}

const AdminActivityPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const isRtl = i18n.language === 'ar';

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      setEntries(page === 0 ? (data || []) : prev => [...prev, ...(data || [])]);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtimeSubscription('activity_log', () => { setPage(0); fetchData(); }, true);

  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (e.actor_name || '').toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      e.entity_type.toLowerCase().includes(q)
    );
  });

  const fmt = (ts: string) =>
    new Date(ts).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'medium' });

  const entityColor: Record<string, string> = {
    case: 'bg-primary/10 text-primary',
    appointment: 'bg-purple-100 text-purple-800',
    submission: 'bg-teal-100 text-teal-800',
    student: 'bg-blue-100 text-blue-800',
    team: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{t('admin.activity.title', 'Live Activity Feed')}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setPage(0); fetchData(); }}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('admin.activity.search', 'Search activity...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('common.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('admin.activity.noActivity')}</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(entry => (
                <div key={entry.id} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{entry.actor_name || t('admin.commandCenter.system', 'System')}</p>
                      <Badge
                        variant="outline"
                        className={`text-xs ${entityColor[entry.entity_type] || 'bg-muted text-muted-foreground'}`}
                      >
                        {entry.entity_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmt(entry.created_at)}</p>
                  </div>
                </div>
              ))}
              {!search && entries.length === (page + 1) * PAGE_SIZE && (
                <div className="p-4 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)}>
                    {t('common.loadMore')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminActivityPage;
