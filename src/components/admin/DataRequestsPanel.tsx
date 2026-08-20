import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Row {
  id: string;
  user_id: string;
  request_type: string;
  status: string;
  message: string | null;
  admin_note: string | null;
  created_at: string;
}

const STATUSES = ['pending', 'in_progress', 'completed', 'rejected'] as const;

const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'outline',
  rejected: 'destructive',
};

interface Props {
  search?: string;
  onCount?: (total: number, pending: number) => void;
}

const DataRequestsPanel: React.FC<Props> = ({ search = '', onCount }) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('data_requests')
      .select('id, user_id, request_type, status, message, admin_note, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', description: error.message });
      setLoading(false);
      return;
    }

    const list = (data ?? []) as Row[];
    setRows(list);

    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      const map: Record<string, { full_name: string | null; email: string | null }> = {};
      (profs ?? []).forEach((p: any) => {
        map[p.id] = { full_name: p.full_name, email: p.email };
      });
      setProfiles(map);
    }

    onCount?.(list.length, list.filter((r) => r.status === 'pending').length);
    setLoading(false);
  }, [onCount, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (row: Row, patch: Partial<Pick<Row, 'status' | 'admin_note'>>) => {
    setSaving(row.id);
    const { data: { user } } = await supabase.auth.getUser();
    const isTerminal = patch.status && ['completed', 'rejected'].includes(patch.status);
    const { error } = await supabase
      .from('data_requests')
      .update({
        ...patch,
        handled_by: user?.id ?? null,
        ...(isTerminal ? { handled_at: new Date().toISOString() } : {}),
      })
      .eq('id', row.id);
    setSaving(null);
    if (error) {
      toast({ variant: 'destructive', description: error.message });
      return;
    }
    await load();
  };

  const term = search.trim().toLowerCase();
  const visible = term
    ? rows.filter((r) => {
        const p = profiles[r.user_id];
        return [p?.full_name, p?.email, r.message, r.request_type]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      })
    : rows;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!visible.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('myData.empty')}</p>;
  }

  return (
    <div className="space-y-3">
      {visible.map((row) => {
        const profile = profiles[row.user_id];
        return (
          <Card key={row.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                    {t(`myData.type.${row.request_type}`)}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {profile?.full_name ?? row.user_id} · {profile?.email ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString('en-US')}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[row.status] ?? 'secondary'}>
                  {t(`myData.status.${row.status}`)}
                </Badge>
              </div>

              {row.message && <p className="text-sm">{row.message}</p>}

              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px]">
                  <Select
                    value={row.status}
                    onValueChange={(value) => update(row, { status: value })}
                  >
                    <SelectTrigger aria-label={t('myData.historyTitle')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`myData.status.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[220px]">
                  <Textarea
                    rows={2}
                    value={notes[row.id] ?? row.admin_note ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    placeholder={t('myData.messagePlaceholder')}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={saving === row.id}
                  onClick={() => update(row, { admin_note: notes[row.id] ?? row.admin_note ?? '' })}
                >
                  {t('common.save', 'Save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default DataRequestsPanel;
