import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search, Filter } from 'lucide-react';

interface AuditLogProps {
  logs: any[];
}

const AuditLog: React.FC<AuditLogProps> = ({ logs }) => {
  const { t, i18n } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  // Extract unique actions for filter
  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map(l => l.action));
    return Array.from(actions).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (search && !(
        log.action?.toLowerCase().includes(search.toLowerCase()) ||
        log.details?.toLowerCase().includes(search.toLowerCase()) ||
        log.target_table?.toLowerCase().includes(search.toLowerCase())
      )) return false;
      return true;
    });
  }, [logs, search, actionFilter]);

  const FilterBar = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('admin.audit.searchPlaceholder', { defaultValue: 'Search logs...' })}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>
      <Select value={actionFilter} onValueChange={setActionFilter}>
        <SelectTrigger className="w-[180px]">
          <Filter className="h-4 w-4 me-2" />
          <SelectValue placeholder={t('admin.audit.action')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('admin.leads.all', 'All')}</SelectItem>
          {uniqueActions.map(action => (
            <SelectItem key={action} value={action}>{action}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (isMobile) {
    return (
      <div className="space-y-3">
        <FilterBar />
        {filtered.map(log => (
          <Card key={log.id} className="overflow-hidden">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">{log.action}</Badge>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString(locale)}</span>
              </div>
              {log.details && <p className="text-xs text-muted-foreground break-all">{log.details}</p>}
              {log.target_table && <p className="text-xs text-muted-foreground">{t('admin.audit.table')}: {log.target_table}</p>}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.audit.noLogs')}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FilterBar />
      <Card className="w-full overflow-hidden max-h-[600px] overflow-y-auto">
        <div className="w-full overflow-x-auto">
        <table className="min-w-full table-auto text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-start font-semibold">{t('admin.audit.action')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('admin.audit.details')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('admin.audit.table')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('admin.audit.date')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => (
              <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3"><Badge variant="secondary">{log.action}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs break-all">{log.details || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{log.target_table || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(log.created_at).toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.audit.noLogs')}</p>}
        </div>
      </Card>
    </div>
  );
};

export default AuditLog;
