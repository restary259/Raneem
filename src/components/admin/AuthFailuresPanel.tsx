import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthFailureSpikes } from '@/hooks/useAuthFailureSpikes';

interface FailureRow {
  id: string;
  source: string;
  target: string;
  operation: string | null;
  status_code: string | null;
  error_message: string | null;
  path: string | null;
  is_anonymous: boolean;
  created_at: string;
}

const AuthFailuresPanel: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const [rows, setRows] = useState<FailureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');
  const { spikes, refetch: refetchSpikes } = useAuthFailureSpikes(0);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('auth_failure_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setRows((data ?? []) as FailureRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => rows.filter(r => sourceFilter === 'all' || r.source === sourceFilter),
    [rows, sourceFilter],
  );

  const grouped = useMemo(() => {
    const now = Date.now();
    const map = new Map<string, { target: string; source: string; last24h: number; last7d: number }>();
    for (const r of filtered) {
      const key = `${r.source}::${r.target}`;
      const entry = map.get(key) ?? { target: r.target, source: r.source, last24h: 0, last7d: 0 };
      const age = now - new Date(r.created_at).getTime();
      if (age <= 24 * 3600 * 1000) entry.last24h += 1;
      if (age <= 7 * 24 * 3600 * 1000) entry.last7d += 1;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.last7d - a.last7d);
  }, [filtered]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="space-y-4">
      {spikes.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <ShieldAlert className="h-4 w-4" />
            {t('admin.authFailures.spikeTitle', 'Authorization failure spike detected')}
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {spikes.map(s => (
              <li key={`${s.source}-${s.target}`}>
                <span className="font-mono">{s.target}</span> — {s.failure_count}{' '}
                {t('admin.authFailures.failures', 'failures')} ({s.source})
                {s.is_new && (
                  <Badge variant="destructive" className="ms-2">
                    {t('admin.authFailures.new', 'New')}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">
            {t('admin.authFailures.title', 'Authorization Failures')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.leads.all', 'All')}</SelectItem>
                <SelectItem value="rls">{t('admin.authFailures.sourceRls', 'Database (RLS)')}</SelectItem>
                <SelectItem value="edge_function">
                  {t('admin.authFailures.sourceEdge', 'Backend function')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => { load(); refetchSpikes(); }}
              aria-label={t('admin.students.refresh', 'Refresh')}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
              {t('admin.authFailures.byTarget', 'By target')}
            </h4>
            {grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {loading
                  ? t('common.loading', 'Loading...')
                  : t('admin.authFailures.empty', 'No authorization failures recorded.')}
              </p>
            ) : (
              <div className="space-y-1">
                {grouped.map(g => (
                  <div
                    key={`${g.source}-${g.target}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="font-mono truncate">{g.target}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary">24h: {g.last24h}</Badge>
                      <Badge variant="outline">7d: {g.last7d}</Badge>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
              {t('admin.authFailures.recent', 'Recent denials')}
            </h4>
            <div className="space-y-1">
              {filtered.slice(0, 50).map(r => (
                <div key={r.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="destructive">{r.status_code ?? '403'}</Badge>
                    <span className="font-mono">{r.target}</span>
                    {r.operation && <span className="text-muted-foreground">{r.operation}</span>}
                    <span className="ms-auto text-xs text-muted-foreground">{fmt(r.created_at)}</span>
                  </div>
                  {r.error_message && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{r.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthFailuresPanel;
